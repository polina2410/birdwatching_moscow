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
    PRIVATE_WALK = 'PRIVATE_WALK', 'Частная прогулка'
    EXPEDITION = 'EXPEDITION', 'Экспедиция'


class RequestStatus(models.TextChoices):
    NEW = 'NEW', 'Новая'
    WAITLIST = 'WAITLIST', 'Лист ожидания'


class TeamMember(models.Model):
    id = models.AutoField(primary_key=True, verbose_name='ID')
    name = models.CharField(max_length=50, db_column='name', verbose_name='Имя')
    photoUrl = models.CharField(max_length=2048, db_column='photoUrl', verbose_name='Фото')
    education = models.TextField(null=True, blank=True, db_column='education', verbose_name='Образование')
    achievements = models.TextField(null=True, blank=True, db_column='achievements', verbose_name='Достижения')
    profileLinks = ArrayField(models.TextField(), db_column='profileLinks', verbose_name='Ссылки на профили')
    sortOrder = models.IntegerField(db_column='sortOrder', verbose_name='Порядок сортировки')

    class Meta:
        managed = False
        db_table = 'TeamMember'
        verbose_name = 'члена команды'
        verbose_name_plural = 'Команда'

    def __str__(self):
        return self.name


class Walk(models.Model):
    id = models.CharField(max_length=36, primary_key=True, db_column='id', verbose_name='ID')
    slug = models.CharField(max_length=200, unique=True, db_column='slug', verbose_name='Слаг')
    title = models.CharField(max_length=150, db_column='title', verbose_name='Название')
    description = models.TextField(db_column='description', verbose_name='Описание')
    startsAt = models.DateTimeField(db_column='startsAt', verbose_name='Начало')
    duration = models.CharField(max_length=100, null=True, blank=True, db_column='duration', verbose_name='Длительность')
    location = models.CharField(max_length=100, db_column='location', verbose_name='Место проведения')
    priceKopecks = models.IntegerField(db_column='priceKopecks', verbose_name='Цена (копейки)')
    capacity = models.IntegerField(db_column='capacity', verbose_name='Вместимость')
    guide = models.ForeignKey(TeamMember, on_delete=models.RESTRICT, db_column='guideId', verbose_name='Гид')
    status = models.CharField(max_length=20, choices=EventStatus.choices, default=EventStatus.DRAFT, db_column='status', verbose_name='Статус')
    coverPhotoUrl = models.CharField(max_length=2048, db_column='coverPhotoUrl', verbose_name='Фото обложки')
    publishedAt = models.DateTimeField(null=True, blank=True, db_column='publishedAt', verbose_name='Опубликовано')
    publishedBy = models.CharField(max_length=36, null=True, blank=True, db_column='publishedBy', verbose_name='Опубликовал')
    createdAt = models.DateTimeField(db_column='createdAt', verbose_name='Создано')

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
    # primary_key=True prevents Django from generating a nonexistent "id" column in queries
    A = models.ForeignKey('Expedition', on_delete=models.CASCADE, db_column='A', related_name='+', primary_key=True)
    B = models.ForeignKey(TeamMember, on_delete=models.CASCADE, db_column='B', related_name='+')

    class Meta:
        managed = False
        db_table = '_ExpeditionToTeamMember'


class Expedition(models.Model):
    id = models.CharField(max_length=36, primary_key=True, db_column='id', verbose_name='ID')
    slug = models.CharField(max_length=200, unique=True, db_column='slug', verbose_name='Слаг')
    title = models.CharField(max_length=150, db_column='title', verbose_name='Название')
    description = models.TextField(db_column='description', verbose_name='Описание')
    startsAt = models.DateTimeField(db_column='startsAt', verbose_name='Начало')
    endsAt = models.DateTimeField(null=True, blank=True, db_column='endsAt', verbose_name='Окончание')
    location = models.CharField(max_length=100, db_column='location', verbose_name='Место проведения')
    totalSpots = models.IntegerField(db_column='totalSpots', verbose_name='Всего мест')
    spotsLeft = models.IntegerField(db_column='spotsLeft', verbose_name='Осталось мест')
    status = models.CharField(max_length=20, choices=EventStatus.choices, default=EventStatus.DRAFT, db_column='status', verbose_name='Статус')
    coverPhotoUrl = models.CharField(max_length=2048, db_column='coverPhotoUrl', verbose_name='Фото обложки')
    publishedAt = models.DateTimeField(null=True, blank=True, db_column='publishedAt', verbose_name='Опубликовано')
    publishedBy = models.CharField(max_length=36, null=True, blank=True, db_column='publishedBy', verbose_name='Опубликовал')
    createdAt = models.DateTimeField(db_column='createdAt', verbose_name='Создано')
    guides = models.ManyToManyField(
        TeamMember,
        through=ExpeditionToTeamMember,
        through_fields=('A', 'B'),
        related_name='expeditions',
        verbose_name='Гиды',
    )

    class Meta:
        managed = False
        db_table = 'Expedition'
        verbose_name = 'экспедицию'
        verbose_name_plural = 'Экспедиции'

    def __str__(self):
        return self.title


class ExpeditionDay(models.Model):
    id = models.CharField(max_length=36, primary_key=True, db_column='id', verbose_name='ID')
    expedition = models.ForeignKey(Expedition, on_delete=models.RESTRICT, db_column='expeditionId', verbose_name='Экспедиция')
    dayNumber = models.IntegerField(db_column='dayNumber', verbose_name='День')
    title = models.CharField(max_length=150, db_column='title', verbose_name='Название')
    description = models.TextField(db_column='description', verbose_name='Описание')

    class Meta:
        managed = False
        db_table = 'ExpeditionDay'


class AppUser(models.Model):
    id = models.CharField(max_length=36, primary_key=True, db_column='id', verbose_name='ID')
    email = models.CharField(max_length=254, db_column='email', verbose_name='Email')
    passwordHash = models.CharField(max_length=255, db_column='passwordHash', verbose_name='Хэш пароля')
    name = models.CharField(max_length=50, db_column='name', verbose_name='Имя')
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER, db_column='role', verbose_name='Роль')
    createdAt = models.DateTimeField(db_column='createdAt', verbose_name='Создан')
    updatedAt = models.DateTimeField(db_column='updatedAt', verbose_name='Обновлён')
    deletedAt = models.DateTimeField(null=True, blank=True, db_column='deletedAt', verbose_name='Удалён')
    blockedAt = models.DateTimeField(null=True, blank=True, db_column='blockedAt', verbose_name='Заблокирован')

    class Meta:
        managed = False
        db_table = 'User'
        verbose_name = 'пользователя'
        verbose_name_plural = 'Пользователи'

    def __str__(self):
        return self.email


class Request(models.Model):
    id = models.CharField(max_length=36, primary_key=True, db_column='id', verbose_name='ID')
    type = models.CharField(max_length=20, choices=RequestType.choices, db_column='type', verbose_name='Тип')
    expedition = models.ForeignKey(
        Expedition, on_delete=models.SET_NULL, null=True, blank=True, db_column='expeditionId', verbose_name='Экспедиция'
    )
    name = models.CharField(max_length=100, db_column='name', verbose_name='Имя')
    email = models.CharField(max_length=254, db_column='email', verbose_name='Email')
    message = models.TextField(db_column='message', verbose_name='Сообщение')
    status = models.CharField(max_length=20, choices=RequestStatus.choices, default=RequestStatus.NEW, db_column='status', verbose_name='Статус')
    createdAt = models.DateTimeField(db_column='createdAt', verbose_name='Создано')

    class Meta:
        managed = False
        db_table = 'Request'
        verbose_name = 'заявку'
        verbose_name_plural = 'Заявки'

    def __str__(self):
        return f'{self.name} ({self.type})'


class RoleChangeLog(models.Model):
    id = models.CharField(max_length=36, primary_key=True, db_column='id', verbose_name='ID')
    targetUserId = models.CharField(max_length=36, db_column='targetUserId', verbose_name='Пользователь')
    changedByUserId = models.CharField(max_length=36, db_column='changedByUserId', verbose_name='Изменил')
    fromRole = models.CharField(max_length=20, choices=Role.choices, db_column='fromRole', verbose_name='Предыдущая роль')
    toRole = models.CharField(max_length=20, choices=Role.choices, db_column='toRole', verbose_name='Новая роль')
    createdAt = models.DateTimeField(db_column='createdAt', verbose_name='Дата изменения')

    class Meta:
        managed = False
        db_table = 'RoleChangeLog'
