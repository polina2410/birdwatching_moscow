from django.contrib.postgres.fields import ArrayField
from django.db import models


class EventStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Черновик'
    ACTIVE = 'ACTIVE', 'Активна'
    CANCELLED = 'CANCELLED', 'Отменена'
    DELETED = 'DELETED', 'Удалена'


class Role(models.TextChoices):
    USER = 'USER', 'Пользователь'
    ADMIN = 'ADMIN', 'Администратор'
    SUPERADMIN = 'SUPERADMIN', 'Суперадминистратор'


class RequestType(models.TextChoices):
    PRIVATE_WALK = 'PRIVATE_WALK'
    EXPEDITION = 'EXPEDITION'


class RequestStatus(models.TextChoices):
    NEW = 'NEW', 'Новая'
    WAITLIST = 'WAITLIST', 'Лист ожидания'


class TeamMember(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50, db_column='name')
    photoUrl = models.CharField(max_length=2048, db_column='photoUrl')
    education = models.TextField(null=True, blank=True, db_column='education')
    achievements = models.TextField(null=True, blank=True, db_column='achievements')
    profileLinks = ArrayField(models.TextField(), db_column='profileLinks')
    sortOrder = models.IntegerField(db_column='sortOrder')

    class Meta:
        managed = False
        db_table = 'TeamMember'
        verbose_name = 'члена команды'
        verbose_name_plural = 'Команда'

    def __str__(self):
        return self.name


class Walk(models.Model):
    id = models.CharField(max_length=36, primary_key=True, db_column='id')
    slug = models.CharField(max_length=200, unique=True, db_column='slug')
    title = models.CharField(max_length=150, db_column='title')
    description = models.TextField(db_column='description')
    startsAt = models.DateTimeField(db_column='startsAt')
    location = models.CharField(max_length=100, db_column='location')
    priceKopecks = models.IntegerField(db_column='priceKopecks')
    capacity = models.IntegerField(db_column='capacity')
    guide = models.ForeignKey(TeamMember, on_delete=models.RESTRICT, db_column='guideId')
    status = models.CharField(max_length=20, choices=EventStatus.choices, default=EventStatus.DRAFT, db_column='status')
    coverPhotoUrl = models.CharField(max_length=2048, db_column='coverPhotoUrl')
    publishedAt = models.DateTimeField(null=True, blank=True, db_column='publishedAt')
    publishedBy = models.CharField(max_length=36, null=True, blank=True, db_column='publishedBy')
    createdAt = models.DateTimeField(db_column='createdAt')

    class Meta:
        managed = False
        db_table = 'Walk'
        verbose_name = 'прогулку'
        verbose_name_plural = 'Прогулки'

    def __str__(self):
        return self.title


class ExpeditionToTeamMember(models.Model):
    # Through table for Expedition <-> TeamMember M2M (_ExpeditionToTeamMember)
    # B column is INTEGER because TeamMember.id is SERIAL, not UUID
    A = models.ForeignKey('Expedition', on_delete=models.CASCADE, db_column='A', related_name='+')
    B = models.ForeignKey(TeamMember, on_delete=models.CASCADE, db_column='B', related_name='+')

    class Meta:
        managed = False
        db_table = '_ExpeditionToTeamMember'


class Expedition(models.Model):
    id = models.CharField(max_length=36, primary_key=True, db_column='id')
    slug = models.CharField(max_length=200, unique=True, db_column='slug')
    title = models.CharField(max_length=150, db_column='title')
    description = models.TextField(db_column='description')
    startsAt = models.DateTimeField(db_column='startsAt')
    location = models.CharField(max_length=100, db_column='location')
    totalSpots = models.IntegerField(db_column='totalSpots')
    spotsLeft = models.IntegerField(db_column='spotsLeft')
    status = models.CharField(max_length=20, choices=EventStatus.choices, default=EventStatus.DRAFT, db_column='status')
    coverPhotoUrl = models.CharField(max_length=2048, db_column='coverPhotoUrl')
    publishedAt = models.DateTimeField(null=True, blank=True, db_column='publishedAt')
    publishedBy = models.CharField(max_length=36, null=True, blank=True, db_column='publishedBy')
    createdAt = models.DateTimeField(db_column='createdAt')
    guides = models.ManyToManyField(
        TeamMember,
        through=ExpeditionToTeamMember,
        through_fields=('A', 'B'),
        related_name='expeditions',
    )

    class Meta:
        managed = False
        db_table = 'Expedition'
        verbose_name = 'экспедицию'
        verbose_name_plural = 'Экспедиции'

    def __str__(self):
        return self.title


class ExpeditionDay(models.Model):
    id = models.CharField(max_length=36, primary_key=True, db_column='id')
    expedition = models.ForeignKey(Expedition, on_delete=models.RESTRICT, db_column='expeditionId')
    dayNumber = models.IntegerField(db_column='dayNumber')
    title = models.CharField(max_length=150, db_column='title')
    description = models.TextField(db_column='description')

    class Meta:
        managed = False
        db_table = 'ExpeditionDay'


class AppUser(models.Model):
    id = models.CharField(max_length=36, primary_key=True, db_column='id')
    email = models.CharField(max_length=254, db_column='email')
    passwordHash = models.CharField(max_length=255, db_column='passwordHash')
    name = models.CharField(max_length=50, db_column='name')
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER, db_column='role')
    createdAt = models.DateTimeField(db_column='createdAt')
    updatedAt = models.DateTimeField(db_column='updatedAt')
    deletedAt = models.DateTimeField(null=True, blank=True, db_column='deletedAt')
    blockedAt = models.DateTimeField(null=True, blank=True, db_column='blockedAt')

    class Meta:
        managed = False
        db_table = 'User'
        verbose_name = 'пользователя'
        verbose_name_plural = 'Пользователи'

    def __str__(self):
        return self.email


class Request(models.Model):
    id = models.CharField(max_length=36, primary_key=True, db_column='id')
    type = models.CharField(max_length=20, choices=RequestType.choices, db_column='type')
    expedition = models.ForeignKey(
        Expedition, on_delete=models.SET_NULL, null=True, blank=True, db_column='expeditionId'
    )
    name = models.CharField(max_length=100, db_column='name')
    email = models.CharField(max_length=254, db_column='email')
    message = models.TextField(db_column='message')
    status = models.CharField(max_length=20, choices=RequestStatus.choices, default=RequestStatus.NEW, db_column='status')
    createdAt = models.DateTimeField(db_column='createdAt')

    class Meta:
        managed = False
        db_table = 'Request'
        verbose_name = 'заявку'
        verbose_name_plural = 'Заявки'

    def __str__(self):
        return f'{self.name} ({self.type})'


class RoleChangeLog(models.Model):
    id = models.CharField(max_length=36, primary_key=True, db_column='id')
    targetUserId = models.CharField(max_length=36, db_column='targetUserId')
    changedByUserId = models.CharField(max_length=36, db_column='changedByUserId')
    fromRole = models.CharField(max_length=20, choices=Role.choices, db_column='fromRole')
    toRole = models.CharField(max_length=20, choices=Role.choices, db_column='toRole')
    createdAt = models.DateTimeField(db_column='createdAt')

    class Meta:
        managed = False
        db_table = 'RoleChangeLog'
