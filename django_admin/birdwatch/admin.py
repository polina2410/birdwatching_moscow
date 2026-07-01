import uuid

from django import forms
from django.contrib import admin, messages
from django.utils.html import format_html
from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import PermissionDenied
from django.db import models
from django.template.response import TemplateResponse
from django.utils import timezone
from django.utils.text import slugify

from birdwatch.models import (
    AppUser,
    EventStatus,
    Expedition,
    ExpeditionDay,
    Request,
    RequestStatus,
    Role,
    RoleChangeLog,
    TeamMember,
    Walk,
)

_STATUS_PALETTE = {
    'DRAFT':     ('#6c757d', '#fff'),
    'ACTIVE':    ('#28a745', '#fff'),
    'CANCELLED': ('#dc3545', '#fff'),
    'DELETED':   ('#343a40', '#fff'),
    'NEW':       ('#0d6efd', '#fff'),
    'WAITLIST':  ('#fd7e14', '#fff'),
}


def _colored_status(obj):
    bg, fg = _STATUS_PALETTE.get(obj.status, ('#6c757d', '#fff'))
    return format_html(
        '<span style="background:{};color:{};padding:2px 10px;'
        'border-radius:4px;font-size:.85em;white-space:nowrap">{}</span>',
        bg, fg, obj.get_status_display(),
    )


class BirdwatchAdminSite(admin.AdminSite):
    """Admin site with flat URLs: /admin/<model>/ instead of /admin/birdwatch/<model>/."""

    def get_urls(self):
        from django.urls import include, path

        standard = super().get_urls()

        # Strip app-prefixed model patterns (e.g. 'birdwatch/walk/') from the
        # standard list, then re-add them as flat paths ('walk/').
        app_labels = {m._meta.app_label for m in self._registry}
        non_model = [
            p for p in standard
            if not any(str(p.pattern).startswith(lbl) for lbl in app_labels)
        ]

        flat = [
            path('%s/' % model._meta.model_name, include(ma.urls))
            for model, ma in self._registry.items()
        ]

        return flat + non_model


admin.site.__class__ = BirdwatchAdminSite
admin.site.site_header = 'Birdwatching Moscow'
admin.site.site_title = 'BM'
admin.site.index_title = 'Панель администратора'


# ---------------------------------------------------------------------------
# Widgets / mixins
# ---------------------------------------------------------------------------

class DateTimeLocalInput(forms.DateTimeInput):
    """Native browser datetime-local picker — supports year selection."""
    input_type = 'datetime-local'


class DateTimeLocalMixin:
    """Apply DateTimeLocalInput to every editable DateTimeField on the model."""
    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if isinstance(db_field, models.DateTimeField):
            kwargs['widget'] = DateTimeLocalInput(format='%Y-%m-%dT%H:%M')
        field = super().formfield_for_dbfield(db_field, request, **kwargs)
        if field and isinstance(db_field, models.DateTimeField):
            field.input_formats = ['%Y-%m-%dT%H:%M']
        return field


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _unique_slug(model_class, title, exclude_pk=None):
    base = slugify(title, allow_unicode=False) or str(uuid.uuid4())[:8]
    slug = base
    n = 1
    while True:
        qs = model_class.objects.filter(slug=slug)
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        if not qs.exists():
            return slug
        slug = f'{base}-{n}'
        n += 1


def _publisher_id(request):
    try:
        return AppUser.objects.get(email=request.user.email).id
    except AppUser.DoesNotExist:
        return None


# ---------------------------------------------------------------------------
# TeamMember
# ---------------------------------------------------------------------------

class TeamMemberForm(forms.ModelForm):
    profile_links_text = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 4}),
        required=False,
        label='Ссылки на профили (по одной на строке)',
    )

    class Meta:
        model = TeamMember
        exclude = ['profileLinks']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields['profile_links_text'].initial = '\n'.join(
                self.instance.profileLinks or []
            )

    def save(self, commit=True):
        instance = super().save(commit=False)
        raw = self.cleaned_data.get('profile_links_text', '')
        instance.profileLinks = [ln.strip() for ln in raw.splitlines() if ln.strip()]
        if commit:
            instance.save()
        return instance


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    form = TeamMemberForm
    list_display = ['name', 'sortOrder']
    ordering = ['sortOrder']
    search_fields = ['name']


# ---------------------------------------------------------------------------
# Walk
# ---------------------------------------------------------------------------

@admin.register(Walk)
class WalkAdmin(DateTimeLocalMixin, admin.ModelAdmin):
    list_display = ['title', 'startsAt', 'colored_status', 'location', 'price_roubles', 'capacity']
    list_filter = ['status']
    search_fields = ['title', 'slug', 'location']
    ordering = ['-startsAt']
    readonly_fields = ['id', 'createdAt', 'publishedAt', 'publishedBy']
    actions = ['publish_walks', 'cancel_walks', 'restore_walks']

    @admin.display(description='Статус')
    def colored_status(self, obj):
        return _colored_status(obj)

    def price_roubles(self, obj):
        return f'{obj.priceKopecks // 100} ₽'

    price_roubles.short_description = 'Цена'

    def save_model(self, request, obj, form, change):
        if not change:
            obj.id = obj.id or str(uuid.uuid4())
            if not obj.slug:
                obj.slug = _unique_slug(Walk, obj.title)
            obj.createdAt = timezone.now()
        elif not obj.slug:
            obj.slug = _unique_slug(Walk, obj.title, exclude_pk=obj.pk)
        super().save_model(request, obj, form, change)

    @admin.action(description='Опубликовать')
    def publish_walks(self, request, queryset):
        queryset.update(
            status=EventStatus.ACTIVE,
            publishedAt=timezone.now(),
            publishedBy=_publisher_id(request),
        )

    @admin.action(description='Отменить')
    def cancel_walks(self, request, queryset):
        queryset.update(status=EventStatus.CANCELLED)

    @admin.action(description='Вернуть в черновики')
    def restore_walks(self, request, queryset):
        queryset.update(status=EventStatus.DRAFT)


# ---------------------------------------------------------------------------
# Expedition
# ---------------------------------------------------------------------------

class ExpeditionForm(forms.ModelForm):
    class Meta:
        model = Expedition
        fields = '__all__'

    def clean_totalSpots(self):
        new_total = self.cleaned_data.get('totalSpots')
        if self.instance and self.instance.pk:
            try:
                current = Expedition.objects.get(pk=self.instance.pk)
                booked = current.totalSpots - current.spotsLeft
                if new_total < booked:
                    raise forms.ValidationError(
                        f'Нельзя уменьшить вместимость: уже забронировано {booked} мест.'
                    )
            except Expedition.DoesNotExist:
                pass
        return new_total


class ExpeditionDayInline(admin.StackedInline):
    model = ExpeditionDay
    extra = 1
    ordering = ['dayNumber']
    readonly_fields = ['id']


@admin.register(Expedition)
class ExpeditionAdmin(DateTimeLocalMixin, admin.ModelAdmin):
    form = ExpeditionForm
    list_display = ['title', 'startsAt', 'colored_status', 'totalSpots', 'spotsLeft', 'location']
    list_filter = ['status']
    search_fields = ['title', 'slug', 'location']
    ordering = ['-startsAt']
    readonly_fields = ['id', 'createdAt', 'publishedAt', 'publishedBy', 'spotsLeft']
    inlines = [ExpeditionDayInline]
    actions = ['publish_expeditions', 'cancel_expeditions', 'restore_expeditions']

    @admin.display(description='Статус')
    def colored_status(self, obj):
        return _colored_status(obj)

    def save_model(self, request, obj, form, change):
        if not change:
            obj.id = obj.id or str(uuid.uuid4())
            if not obj.slug:
                obj.slug = _unique_slug(Expedition, obj.title)
            obj.createdAt = timezone.now()
            obj.spotsLeft = obj.totalSpots
        else:
            if not obj.slug:
                obj.slug = _unique_slug(Expedition, obj.title, exclude_pk=obj.pk)
            original = Expedition.objects.get(pk=obj.pk)
            booked = original.totalSpots - original.spotsLeft
            obj.spotsLeft = obj.totalSpots - booked
        super().save_model(request, obj, form, change)

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for instance in instances:
            if isinstance(instance, ExpeditionDay) and not instance.id:
                instance.id = str(uuid.uuid4())
            instance.save()
        formset.save_m2m()
        for obj in formset.deleted_objects:
            obj.delete()

    @admin.action(description='Опубликовать')
    def publish_expeditions(self, request, queryset):
        queryset.update(
            status=EventStatus.ACTIVE,
            publishedAt=timezone.now(),
            publishedBy=_publisher_id(request),
        )

    @admin.action(description='Отменить')
    def cancel_expeditions(self, request, queryset):
        queryset.update(status=EventStatus.CANCELLED)

    @admin.action(description='Вернуть в черновики')
    def restore_expeditions(self, request, queryset):
        queryset.update(status=EventStatus.DRAFT)


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

@admin.register(Request)
class RequestAdmin(admin.ModelAdmin):
    list_display = ['type', 'name', 'email', 'colored_status', 'createdAt']
    list_filter = ['type', 'status']
    search_fields = ['name', 'email']
    readonly_fields = ['id', 'type', 'expedition', 'name', 'email', 'message', 'createdAt']
    actions = ['toggle_status']

    def has_add_permission(self, request):
        return False

    @admin.display(description='Статус')
    def colored_status(self, obj):
        return _colored_status(obj)

    @admin.action(description='Переключить статус (NEW ↔ WAITLIST)')
    def toggle_status(self, request, queryset):
        for obj in queryset:
            obj.status = (
                RequestStatus.WAITLIST
                if obj.status == RequestStatus.NEW
                else RequestStatus.NEW
            )
            obj.save()


# ---------------------------------------------------------------------------
# AppUser
# ---------------------------------------------------------------------------

@admin.register(AppUser)
class AppUserAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'colored_role', 'blocked_status', 'createdAt']
    list_filter = ['role', 'blockedAt']
    search_fields = ['name', 'email']
    readonly_fields = ['id', 'email', 'passwordHash', 'name', 'createdAt', 'updatedAt', 'deletedAt']
    actions = ['block_users', 'unblock_users', 'change_role']

    _ROLE_PALETTE = {
        'USER':       ('#6c757d', '#fff'),
        'ADMIN':      ('#0d6efd', '#fff'),
        'SUPERADMIN': ('#ffc107', '#212529'),
    }

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description='Роль', ordering='role')
    def colored_role(self, obj):
        bg, fg = self._ROLE_PALETTE.get(obj.role, ('#6c757d', '#fff'))
        return format_html(
            '<span style="background:{};color:{};padding:2px 10px;'
            'border-radius:4px;font-size:.85em;white-space:nowrap">{}</span>',
            bg, fg, obj.get_role_display(),
        )

    @admin.display(description='Статус', ordering='blockedAt')
    def blocked_status(self, obj):
        if obj.blockedAt:
            return format_html(
                '<span style="background:#dc3545;color:#fff;padding:2px 10px;'
                'border-radius:4px;font-size:.85em">Заблокирован</span>'
            )
        return format_html(
            '<span style="background:#28a745;color:#fff;padding:2px 10px;'
            'border-radius:4px;font-size:.85em">Активен</span>'
        )

    def has_change_role_permission(self, request):
        return request.user.is_superuser

    def get_actions(self, request):
        actions = super().get_actions(request)
        if not request.user.is_superuser:
            actions.pop('change_role', None)
        return actions

    @admin.action(description='Заблокировать')
    def block_users(self, request, queryset):
        to_block = queryset.filter(blockedAt__isnull=True)
        count = to_block.count()
        if count == 0:
            self.message_user(
                request,
                'Все выбранные пользователи уже заблокированы.',
                level=messages.INFO,
            )
            return
        superadmin_in_selection = to_block.filter(role='SUPERADMIN').count()
        if superadmin_in_selection > 0:
            active = AppUser.objects.filter(
                role='SUPERADMIN', deletedAt__isnull=True, blockedAt__isnull=True
            ).count()
            if active - superadmin_in_selection <= 0:
                self.message_user(
                    request,
                    'Нельзя заблокировать последнего активного суперадминистратора.',
                    level=messages.ERROR,
                )
                return
        to_block.update(blockedAt=timezone.now())
        emails = list(to_block.values_list('email', flat=True))
        User.objects.filter(username__in=emails).update(is_active=False)
        self.message_user(
            request,
            f'Заблокировано пользователей: {count}.',
            level=messages.SUCCESS,
        )

    @admin.action(description='Разблокировать')
    def unblock_users(self, request, queryset):
        to_unblock = queryset.filter(blockedAt__isnull=False)
        count = to_unblock.count()
        if count == 0:
            self.message_user(
                request,
                'Все выбранные пользователи уже активны.',
                level=messages.INFO,
            )
            return
        to_unblock.update(blockedAt=None)
        admin_emails = list(
            to_unblock.filter(role__in=[Role.ADMIN, Role.SUPERADMIN])
            .values_list('email', flat=True)
        )
        User.objects.filter(username__in=admin_emails).update(is_active=True, is_staff=True)
        self.message_user(
            request,
            f'Разблокировано пользователей: {count}.',
            level=messages.SUCCESS,
        )

    @admin.action(description='Изменить роль')
    def change_role(self, request, queryset):
        if not self.has_change_role_permission(request):
            raise PermissionDenied

        if 'apply' not in request.POST:
            return TemplateResponse(
                request,
                'admin/birdwatch/change_role_intermediate.html',
                {
                    'title': 'Изменить роль',
                    'queryset': queryset,
                    'action_checkbox_name': admin.helpers.ACTION_CHECKBOX_NAME,
                    'roles': ['USER', 'ADMIN', 'SUPERADMIN'],
                    'opts': self.model._meta,
                },
            )

        new_role = request.POST.get('new_role')
        if not new_role or new_role not in Role.values:
            self.message_user(request, 'Недопустимая роль.', level=messages.ERROR)
            return

        try:
            changer = AppUser.objects.get(email=request.user.email)
        except AppUser.DoesNotExist:
            self.message_user(
                request,
                'Ваш аккаунт не найден в системе. Действие отменено.',
                level=messages.ERROR,
            )
            return

        for target in queryset:
            if target.id == changer.id:
                self.message_user(
                    request,
                    f'Нельзя изменить собственную роль ({target.email}).',
                    level=messages.ERROR,
                )
                continue

            if target.role == 'SUPERADMIN':
                active = AppUser.objects.filter(
                    role='SUPERADMIN', deletedAt__isnull=True
                ).count()
                if active <= 1:
                    self.message_user(
                        request,
                        f'Нельзя изменить роль последнего суперадминистратора ({target.email}).',
                        level=messages.ERROR,
                    )
                    continue

            from_role = target.role
            target.role = new_role
            target.save()

            User.objects.filter(username=target.email).update(
                is_superuser=(new_role == Role.SUPERADMIN),
                is_staff=(new_role in (Role.ADMIN, Role.SUPERADMIN)),
            )

            RoleChangeLog.objects.create(
                id=str(uuid.uuid4()),
                targetUserId=target.id,
                changedByUserId=changer.id,
                fromRole=from_role,
                toRole=new_role,
                createdAt=timezone.now(),
            )
