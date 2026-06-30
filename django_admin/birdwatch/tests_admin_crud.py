"""
Failing tests for django-admin-crud feature.
All tests use SimpleTestCase — no live DB required.
Run: DJANGO_DEBUG=true DATABASE_URL="postgresql://user:pass@localhost:5432/testdb" python manage.py test birdwatch.tests_admin_crud
"""
import inspect

from django.contrib import admin
from django.test import SimpleTestCase

from birdwatch.admin import (
    ExpeditionAdmin,
    RequestAdmin,
    TeamMemberAdmin,
    WalkAdmin,
)
from birdwatch.models import Expedition, Request, TeamMember, Walk


# ---------------------------------------------------------------------------
# Walk
# ---------------------------------------------------------------------------

class WalkAdminSaveModelTest(SimpleTestCase):
    def setUp(self):
        self.wa = WalkAdmin(Walk, admin.site)

    def test_save_model_is_overridden(self):
        # Must be overridden to auto-set id, slug, createdAt on creation
        self.assertNotEqual(
            type(self.wa).save_model,
            admin.ModelAdmin.save_model,
            'WalkAdmin must override save_model to handle UUID, slug, and createdAt',
        )

    def test_save_model_is_defined_on_walk_admin_directly(self):
        # Must be defined directly on WalkAdmin, not just inherited
        self.assertIn(
            'save_model',
            WalkAdmin.__dict__,
            'save_model must be defined directly on WalkAdmin, not just inherited',
        )


class WalkAdminActionsTest(SimpleTestCase):
    def test_publish_action_registered(self):
        self.assertIn('publish_walks', WalkAdmin.actions or [])

    def test_cancel_action_registered(self):
        self.assertIn('cancel_walks', WalkAdmin.actions or [])

    def test_restore_action_registered(self):
        self.assertIn('restore_walks', WalkAdmin.actions or [])


class WalkAdminPublishMethodTest(SimpleTestCase):
    def test_publish_walks_method_exists(self):
        self.assertTrue(
            callable(getattr(WalkAdmin, 'publish_walks', None)),
            'WalkAdmin must have a publish_walks method',
        )

    def test_cancel_walks_method_exists(self):
        self.assertTrue(
            callable(getattr(WalkAdmin, 'cancel_walks', None)),
            'WalkAdmin must have a cancel_walks method',
        )

    def test_restore_walks_method_exists(self):
        self.assertTrue(
            callable(getattr(WalkAdmin, 'restore_walks', None)),
            'WalkAdmin must have a restore_walks method',
        )


# ---------------------------------------------------------------------------
# Expedition
# ---------------------------------------------------------------------------

class ExpeditionAdminSaveModelTest(SimpleTestCase):
    def setUp(self):
        self.ea = ExpeditionAdmin(Expedition, admin.site)

    def test_save_model_is_overridden(self):
        self.assertNotEqual(
            type(self.ea).save_model,
            admin.ModelAdmin.save_model,
            'ExpeditionAdmin must override save_model to handle UUID, slug, and createdAt',
        )


class ExpeditionAdminInlinesTest(SimpleTestCase):
    def test_has_expedition_day_inline(self):
        inline_names = [cls.__name__ for cls in (ExpeditionAdmin.inlines or [])]
        self.assertIn(
            'ExpeditionDayInline',
            inline_names,
            'ExpeditionAdmin.inlines must include ExpeditionDayInline',
        )


class ExpeditionAdminActionsTest(SimpleTestCase):
    def test_publish_action_registered(self):
        self.assertIn('publish_expeditions', ExpeditionAdmin.actions or [])

    def test_cancel_action_registered(self):
        self.assertIn('cancel_expeditions', ExpeditionAdmin.actions or [])

    def test_restore_action_registered(self):
        self.assertIn('restore_expeditions', ExpeditionAdmin.actions or [])


class ExpeditionDayInlineExistsTest(SimpleTestCase):
    def test_expedition_day_inline_class_defined_in_admin_module(self):
        import birdwatch.admin as admin_module
        self.assertTrue(
            hasattr(admin_module, 'ExpeditionDayInline'),
            'ExpeditionDayInline class must be defined in birdwatch.admin',
        )

    def test_expedition_day_inline_is_stacked_or_tabular(self):
        import birdwatch.admin as admin_module
        inline_cls = getattr(admin_module, 'ExpeditionDayInline', None)
        if inline_cls is None:
            self.fail('ExpeditionDayInline not defined')
        self.assertTrue(
            issubclass(inline_cls, (admin.StackedInline, admin.TabularInline)),
            'ExpeditionDayInline must be a StackedInline or TabularInline',
        )


# ---------------------------------------------------------------------------
# TeamMember
# ---------------------------------------------------------------------------

class TeamMemberAdminProfileLinksTest(SimpleTestCase):
    def test_has_custom_form_or_get_form_override(self):
        # Check if form is defined directly on the class (not just inherited ModelForm)
        # OR if get_form is overridden directly on the class
        has_custom_form = (
            'form' in TeamMemberAdmin.__dict__ and TeamMemberAdmin.__dict__['form'] is not None
        ) or 'get_form' in TeamMemberAdmin.__dict__
        self.assertTrue(
            has_custom_form,
            'TeamMemberAdmin must define a custom form or override get_form to handle profileLinks array',
        )


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class RequestAdminToggleStatusTest(SimpleTestCase):
    def test_toggle_status_action_registered(self):
        self.assertIn('toggle_status', RequestAdmin.actions or [])

    def test_toggle_status_method_exists(self):
        self.assertTrue(
            callable(getattr(RequestAdmin, 'toggle_status', None)),
            'RequestAdmin must have a toggle_status method',
        )

    def test_add_still_disabled(self):
        ra = RequestAdmin(Request, admin.site)

        class FakeRequest:
            pass

        self.assertFalse(
            ra.has_add_permission(FakeRequest()),
            'RequestAdmin must still block adding new requests',
        )
