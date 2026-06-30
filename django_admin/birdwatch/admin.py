import uuid

from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied
from django.template.response import TemplateResponse
from django.utils import timezone

from birdwatch.models import AppUser, Expedition, Request, RoleChangeLog, TeamMember, Walk


@admin.register(Walk)
class WalkAdmin(admin.ModelAdmin):
    list_display = ['title', 'startsAt', 'status', 'location', 'price_roubles', 'capacity']
    list_filter = ['status']
    search_fields = ['title', 'slug', 'location']
    ordering = ['-startsAt']

    def price_roubles(self, obj):
        return f'{obj.priceKopecks // 100} ₽'

    price_roubles.short_description = 'Цена'


@admin.register(Expedition)
class ExpeditionAdmin(admin.ModelAdmin):
    list_display = ['title', 'startsAt', 'status', 'totalSpots', 'spotsLeft', 'location']
    list_filter = ['status']
    search_fields = ['title', 'slug', 'location']
    ordering = ['-startsAt']


@admin.register(Request)
class RequestAdmin(admin.ModelAdmin):
    list_display = ['type', 'name', 'email', 'status', 'createdAt']
    list_filter = ['type', 'status']
    search_fields = ['name', 'email']
    readonly_fields = ['id', 'type', 'expedition', 'name', 'email', 'message', 'createdAt']

    def has_add_permission(self, request):
        return False


@admin.register(AppUser)
class AppUserAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'role', 'blockedAt', 'createdAt', 'deletedAt']
    list_filter = ['role']
    search_fields = ['name', 'email']
    readonly_fields = ['id', 'email', 'passwordHash', 'name', 'createdAt', 'updatedAt', 'deletedAt']
    actions = ['block_users', 'unblock_users', 'change_role']

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_role_permission(self, request):
        return request.user.is_superuser

    def get_actions(self, request):
        actions = super().get_actions(request)
        if not request.user.is_superuser:
            actions.pop('change_role', None)
        return actions

    @admin.action(description='Заблокировать')
    def block_users(self, request, queryset):
        superadmin_in_selection = queryset.filter(role='SUPERADMIN').count()
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
        queryset.update(blockedAt=timezone.now())

    @admin.action(description='Разблокировать')
    def unblock_users(self, request, queryset):
        queryset.update(blockedAt=None)

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
        if not new_role:
            self.message_user(request, 'Не выбрана роль.', level=messages.ERROR)
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

            RoleChangeLog.objects.create(
                id=str(uuid.uuid4()),
                targetUserId=target.id,
                changedByUserId=changer.id,
                fromRole=from_role,
                toRole=new_role,
                createdAt=timezone.now(),
            )


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ['name', 'sortOrder']
    ordering = ['sortOrder']
    search_fields = ['name']
