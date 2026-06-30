from unittest.mock import patch, MagicMock, call, ANY
from django.test import SimpleTestCase
from django.contrib.admin.sites import AdminSite
from django.contrib import admin
from django.core.exceptions import PermissionDenied

from birdwatch.admin import (
    WalkAdmin, ExpeditionAdmin, RequestAdmin, AppUserAdmin, TeamMemberAdmin,
)
from birdwatch.models import Walk, Expedition, Request, AppUser, TeamMember


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

class AdminRegistrationTest(SimpleTestCase):
    def test_walk_registered(self):
        self.assertIn(Walk, admin.site._registry)

    def test_expedition_registered(self):
        self.assertIn(Expedition, admin.site._registry)

    def test_request_registered(self):
        self.assertIn(Request, admin.site._registry)

    def test_appuser_registered(self):
        self.assertIn(AppUser, admin.site._registry)

    def test_teammember_registered(self):
        self.assertIn(TeamMember, admin.site._registry)


# ---------------------------------------------------------------------------
# WalkAdmin — price_roubles computed column
# ---------------------------------------------------------------------------

class WalkAdminTest(SimpleTestCase):
    def setUp(self):
        self.walk_admin = WalkAdmin(Walk, AdminSite())

    def test_price_roubles_formats_kopecks(self):
        walk = MagicMock(priceKopecks=12300)
        self.assertEqual(self.walk_admin.price_roubles(walk), '123 ₽')

    def test_price_roubles_rounds_down(self):
        walk = MagicMock(priceKopecks=12350)
        self.assertEqual(self.walk_admin.price_roubles(walk), '123 ₽')

    def test_price_roubles_short_description(self):
        self.assertEqual(self.walk_admin.price_roubles.short_description, 'Цена')


# ---------------------------------------------------------------------------
# RequestAdmin — no add permission
# ---------------------------------------------------------------------------

class RequestAdminTest(SimpleTestCase):
    def setUp(self):
        self.request_admin = RequestAdmin(Request, AdminSite())

    def test_has_add_permission_returns_false(self):
        self.assertFalse(self.request_admin.has_add_permission(MagicMock()))


# ---------------------------------------------------------------------------
# AppUserAdmin — permissions
# ---------------------------------------------------------------------------

class AppUserAdminPermissionsTest(SimpleTestCase):
    def setUp(self):
        self.app_user_admin = AppUserAdmin(AppUser, AdminSite())

    def test_has_add_permission_returns_false(self):
        self.assertFalse(self.app_user_admin.has_add_permission(MagicMock()))

    def test_has_delete_permission_returns_false(self):
        self.assertFalse(self.app_user_admin.has_delete_permission(MagicMock()))

    def test_has_change_role_permission_true_for_superuser(self):
        request = MagicMock()
        request.user.is_superuser = True
        self.assertTrue(self.app_user_admin.has_change_role_permission(request))

    def test_has_change_role_permission_false_for_non_superuser(self):
        request = MagicMock()
        request.user.is_superuser = False
        self.assertFalse(self.app_user_admin.has_change_role_permission(request))

    def test_get_actions_excludes_change_role_for_non_superuser(self):
        request = MagicMock()
        request.user.is_superuser = False
        with patch.object(AppUserAdmin, 'get_actions',
                          wraps=self.app_user_admin.get_actions) as _:
            # Directly test the filtering logic: if non-superuser, change_role absent
            all_actions = {'block_users': ..., 'unblock_users': ..., 'change_role': ...}
            with patch('django.contrib.admin.ModelAdmin.get_actions',
                       return_value=dict(all_actions)):
                actions = self.app_user_admin.get_actions(request)
                self.assertNotIn('change_role', actions)

    def test_get_actions_includes_change_role_for_superuser(self):
        request = MagicMock()
        request.user.is_superuser = True
        all_actions = {'block_users': ..., 'unblock_users': ..., 'change_role': ...}
        with patch('django.contrib.admin.ModelAdmin.get_actions',
                   return_value=dict(all_actions)):
            actions = self.app_user_admin.get_actions(request)
            self.assertIn('change_role', actions)


# ---------------------------------------------------------------------------
# block_users / unblock_users actions
# ---------------------------------------------------------------------------

class BlockUnblockActionsTest(SimpleTestCase):
    def setUp(self):
        self.app_user_admin = AppUserAdmin(AppUser, AdminSite())

    @patch('birdwatch.admin.AppUser.objects')
    def test_block_users_sets_blocked_at(self, mock_mgr):
        # No SUPERADMINs in the selection — guard passes
        mock_mgr.filter.return_value.count.return_value = 0  # active SUPERADMINs in selection
        queryset = MagicMock()
        queryset.filter.return_value.count.return_value = 0

        self.app_user_admin.block_users(MagicMock(), queryset)

        queryset.update.assert_called_once()
        kwargs = queryset.update.call_args[1]
        self.assertIsNotNone(kwargs.get('blockedAt'))

    @patch('birdwatch.admin.AppUser.objects')
    def test_block_users_rejects_last_superadmin_all_or_nothing(self, mock_mgr):
        # 1 active SUPERADMIN globally, and 1 SUPERADMIN in the selection → would lock out
        mock_mgr.filter.return_value.count.return_value = 1   # total active SUPERADMINs
        queryset = MagicMock()
        queryset.filter.return_value.count.return_value = 1   # SUPERADMINs in selection

        self.app_user_admin.block_users(MagicMock(), queryset)

        queryset.update.assert_not_called()

    @patch('birdwatch.admin.AppUser.objects')
    def test_block_users_allows_when_other_superadmin_remains(self, mock_mgr):
        # 2 active SUPERADMINs globally, 1 in selection → 1 remains after block
        mock_mgr.filter.return_value.count.return_value = 2
        queryset = MagicMock()
        queryset.filter.return_value.count.return_value = 1

        self.app_user_admin.block_users(MagicMock(), queryset)

        queryset.update.assert_called_once()

    def test_unblock_users_clears_blocked_at(self):
        queryset = MagicMock()
        self.app_user_admin.unblock_users(MagicMock(), queryset)
        queryset.update.assert_called_once_with(blockedAt=None)


# ---------------------------------------------------------------------------
# change_role action
# ---------------------------------------------------------------------------

class ChangeRoleActionTest(SimpleTestCase):
    def setUp(self):
        self.app_user_admin = AppUserAdmin(AppUser, AdminSite())

    def _superuser_request(self, post=None):
        request = MagicMock()
        request.user.is_superuser = True
        request.user.email = 'super@test.ru'
        request.POST = post or {}
        return request

    def test_change_role_raises_permission_denied_for_non_superuser(self):
        request = MagicMock()
        request.user.is_superuser = False
        request.POST = {}
        with self.assertRaises(PermissionDenied):
            self.app_user_admin.change_role(request, MagicMock())

    def test_change_role_renders_intermediate_form_without_apply(self):
        request = self._superuser_request(post={})
        queryset = MagicMock()
        response = self.app_user_admin.change_role(request, queryset)
        # Should return an HttpResponse (the intermediate form), not None
        self.assertIsNotNone(response)

    @patch('birdwatch.admin.AppUser.objects')
    def test_change_role_skips_own_account(self, mock_mgr):
        changer = MagicMock(id='changer-id')
        mock_mgr.get.return_value = changer

        target = MagicMock(id='changer-id', role='ADMIN')  # same id as changer
        request = self._superuser_request(post={'apply': '1', 'new_role': 'USER'})

        self.app_user_admin.change_role(request, [target])

        target.save.assert_not_called()

    @patch('birdwatch.admin.AppUser.objects')
    def test_change_role_rejects_last_superadmin_downgrade(self, mock_mgr):
        changer = MagicMock(id='changer-id')
        mock_mgr.get.return_value = changer
        # Only 1 active SUPERADMIN in DB
        mock_mgr.filter.return_value.count.return_value = 1

        target = MagicMock(id='target-id', role='SUPERADMIN')
        request = self._superuser_request(post={'apply': '1', 'new_role': 'ADMIN'})

        self.app_user_admin.change_role(request, [target])

        target.save.assert_not_called()

    @patch('birdwatch.admin.RoleChangeLog')
    @patch('birdwatch.admin.AppUser.objects')
    def test_change_role_updates_role_and_inserts_log(self, mock_mgr, mock_log_cls):
        changer = MagicMock(id='changer-id')
        mock_mgr.get.return_value = changer
        # 2 active SUPERADMINs — safe to change target (who is USER, not SUPERADMIN)
        mock_mgr.filter.return_value.count.return_value = 2

        target = MagicMock(id='target-id', role='USER')
        request = self._superuser_request(post={'apply': '1', 'new_role': 'ADMIN'})

        self.app_user_admin.change_role(request, [target])

        self.assertEqual(target.role, 'ADMIN')
        target.save.assert_called_once()
        mock_log_cls.objects.create.assert_called_once_with(
            id=ANY,
            targetUserId='target-id',
            changedByUserId='changer-id',
            fromRole='USER',
            toRole='ADMIN',
            createdAt=ANY,
        )

    @patch('birdwatch.admin.AppUser.objects')
    def test_change_role_aborts_when_no_role_selected(self, mock_mgr):
        # apply in POST but new_role missing — should abort before any DB call
        request = self._superuser_request(post={'apply': '1'})
        queryset = MagicMock()
        self.app_user_admin.change_role(request, queryset)
        mock_mgr.get.assert_not_called()

    @patch('birdwatch.admin.AppUser.objects')
    def test_change_role_aborts_if_changer_app_user_not_found(self, mock_mgr):
        mock_mgr.get.side_effect = AppUser.DoesNotExist

        target = MagicMock(id='target-id', role='USER')
        request = self._superuser_request(post={'apply': '1', 'new_role': 'ADMIN'})

        # Should not raise — should abort gracefully
        self.app_user_admin.change_role(request, [target])

        target.save.assert_not_called()
