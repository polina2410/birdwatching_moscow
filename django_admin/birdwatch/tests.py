from unittest.mock import patch, MagicMock, call
from django.test import TestCase
from django.contrib.auth.models import User

from birdwatch.backends import AppUserAuthBackend


class AppUserAuthBackendTest(TestCase):
    def setUp(self):
        self.backend = AppUserAuthBackend()

    # --- authenticate: happy paths ---

    @patch("birdwatch.backends.bcrypt.checkpw", return_value=True)
    @patch("birdwatch.backends.AppUser.objects")
    @patch("birdwatch.backends.User.objects")
    def test_admin_user_can_authenticate(self, mock_auth_user_mgr, mock_app_user_mgr, mock_checkpw):
        app_user = MagicMock(role="ADMIN", blockedAt=None, deletedAt=None, passwordHash=b"hash")
        mock_app_user_mgr.get.return_value = app_user
        django_user = MagicMock(spec=User)
        mock_auth_user_mgr.get_or_create.return_value = (django_user, True)

        result = self.backend.authenticate(None, username="admin@test.ru", password="secret")

        self.assertIsNotNone(result)

    @patch("birdwatch.backends.bcrypt.checkpw", return_value=True)
    @patch("birdwatch.backends.AppUser.objects")
    @patch("birdwatch.backends.User.objects")
    def test_superadmin_user_can_authenticate(self, mock_auth_user_mgr, mock_app_user_mgr, mock_checkpw):
        app_user = MagicMock(role="SUPERADMIN", blockedAt=None, deletedAt=None, passwordHash=b"hash")
        mock_app_user_mgr.get.return_value = app_user
        django_user = MagicMock(spec=User)
        mock_auth_user_mgr.get_or_create.return_value = (django_user, True)

        result = self.backend.authenticate(None, username="superadmin@test.ru", password="secret")

        self.assertIsNotNone(result)

    # --- authenticate: role check ---

    @patch("birdwatch.backends.bcrypt.checkpw", return_value=True)
    @patch("birdwatch.backends.AppUser.objects")
    def test_user_role_cannot_authenticate(self, mock_app_user_mgr, mock_checkpw):
        app_user = MagicMock(role="USER", blockedAt=None, deletedAt=None, passwordHash=b"hash")
        mock_app_user_mgr.get.return_value = app_user

        result = self.backend.authenticate(None, username="user@test.ru", password="secret")

        self.assertIsNone(result)

    # --- authenticate: blocked / deleted ---

    @patch("birdwatch.backends.bcrypt.checkpw", return_value=True)
    @patch("birdwatch.backends.AppUser.objects")
    def test_blocked_user_cannot_authenticate(self, mock_app_user_mgr, mock_checkpw):
        from django.utils import timezone
        app_user = MagicMock(role="ADMIN", blockedAt=timezone.now(), deletedAt=None, passwordHash=b"hash")
        mock_app_user_mgr.get.return_value = app_user

        result = self.backend.authenticate(None, username="blocked@test.ru", password="secret")

        self.assertIsNone(result)

    @patch("birdwatch.backends.AppUser.objects")
    def test_deleted_user_cannot_authenticate(self, mock_app_user_mgr):
        mock_app_user_mgr.get.side_effect = Exception("DoesNotExist")

        result = self.backend.authenticate(None, username="deleted@test.ru", password="secret")

        self.assertIsNone(result)

    # --- authenticate: wrong password ---

    @patch("birdwatch.backends.bcrypt.checkpw", return_value=False)
    @patch("birdwatch.backends.AppUser.objects")
    def test_wrong_password_cannot_authenticate(self, mock_app_user_mgr, mock_checkpw):
        app_user = MagicMock(role="ADMIN", blockedAt=None, deletedAt=None, passwordHash=b"hash")
        mock_app_user_mgr.get.return_value = app_user

        result = self.backend.authenticate(None, username="admin@test.ru", password="wrong")

        self.assertIsNone(result)

    # --- is_superuser sync ---

    @patch("birdwatch.backends.bcrypt.checkpw", return_value=True)
    @patch("birdwatch.backends.AppUser.objects")
    @patch("birdwatch.backends.User.objects")
    def test_superadmin_gets_is_superuser_true(self, mock_auth_user_mgr, mock_app_user_mgr, mock_checkpw):
        app_user = MagicMock(role="SUPERADMIN", blockedAt=None, deletedAt=None, passwordHash=b"hash", email="su@test.ru")
        mock_app_user_mgr.get.return_value = app_user
        django_user = MagicMock(spec=User)
        mock_auth_user_mgr.get_or_create.return_value = (django_user, False)

        self.backend.authenticate(None, username="su@test.ru", password="secret")

        self.assertTrue(django_user.is_superuser)
        django_user.save.assert_called()

    @patch("birdwatch.backends.bcrypt.checkpw", return_value=True)
    @patch("birdwatch.backends.AppUser.objects")
    @patch("birdwatch.backends.User.objects")
    def test_admin_gets_is_superuser_false(self, mock_auth_user_mgr, mock_app_user_mgr, mock_checkpw):
        app_user = MagicMock(role="ADMIN", blockedAt=None, deletedAt=None, passwordHash=b"hash", email="admin@test.ru")
        mock_app_user_mgr.get.return_value = app_user
        django_user = MagicMock(spec=User)
        mock_auth_user_mgr.get_or_create.return_value = (django_user, False)

        self.backend.authenticate(None, username="admin@test.ru", password="secret")

        self.assertFalse(django_user.is_superuser)
        django_user.save.assert_called()

    # --- get_user ---

    @patch("birdwatch.backends.User.objects")
    def test_get_user_returns_user_by_pk(self, mock_auth_user_mgr):
        django_user = MagicMock(spec=User)
        mock_auth_user_mgr.get.return_value = django_user

        result = self.backend.get_user(42)

        self.assertEqual(result, django_user)
        mock_auth_user_mgr.get.assert_called_once_with(pk=42)

    @patch("birdwatch.backends.User.objects")
    def test_get_user_returns_none_if_not_found(self, mock_auth_user_mgr):
        mock_auth_user_mgr.get.side_effect = User.DoesNotExist

        result = self.backend.get_user(999)

        self.assertIsNone(result)