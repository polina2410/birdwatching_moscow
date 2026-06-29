import bcrypt
from django.contrib.auth.models import User

from birdwatch.models import AppUser

_ADMIN_ROLES = {'ADMIN', 'SUPERADMIN'}


class AppUserAuthBackend:
    def authenticate(self, request, username=None, password=None):
        try:
            app_user = AppUser.objects.get(email=username, deletedAt__isnull=True, blockedAt__isnull=True)
        except Exception:
            return None

        if app_user.blockedAt is not None:
            return None

        pwd_hash = app_user.passwordHash
        if isinstance(pwd_hash, str):
            pwd_hash = pwd_hash.encode('utf-8')

        if not bcrypt.checkpw(password.encode('utf-8'), pwd_hash):
            return None

        if app_user.role not in _ADMIN_ROLES:
            return None

        django_user, _ = User.objects.get_or_create(
            username=username,
            defaults={'email': username, 'is_active': True, 'is_staff': True},
        )
        django_user.is_superuser = (app_user.role == 'SUPERADMIN')
        django_user.is_staff = True
        django_user.save()

        return django_user

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
