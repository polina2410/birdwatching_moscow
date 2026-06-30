"""
Tests for production deployment configuration changes.
Spec: context/specs/django-production-deploy/spec.md
"""
import os

from django.conf import settings
from django.test import SimpleTestCase


_SETTINGS_FILE = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'birdwatch_admin', 'settings.py')
)
_REQUIREMENTS_FILE = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'requirements.txt')
)


def _read(path):
    with open(path) as f:
        return f.read()


# ---------------------------------------------------------------------------
# File-content tests  (grep equivalents from the spec's success criteria)
# ---------------------------------------------------------------------------

class HardcodedDebugRemovedTest(SimpleTestCase):
    """DEBUG must be env-driven; the literal 'DEBUG = True' must not appear."""

    def test_debug_is_not_hardcoded_true(self):
        self.assertNotIn(
            'DEBUG = True',
            _read(_SETTINGS_FILE),
            'DEBUG must be env-driven, not hardcoded to True',
        )

    def test_debug_reads_django_debug_env_var(self):
        self.assertIn(
            'DJANGO_DEBUG',
            _read(_SETTINGS_FILE),
            'settings.py must read DEBUG from the DJANGO_DEBUG environment variable',
        )


class HardcodedAllowedHostsRemovedTest(SimpleTestCase):
    """The wildcard ALLOWED_HOSTS must be replaced with an env-driven list."""

    def test_wildcard_allowed_hosts_is_gone(self):
        self.assertNotIn(
            "ALLOWED_HOSTS = ['*']",
            _read(_SETTINGS_FILE),
            "Hardcoded ALLOWED_HOSTS = ['*'] is insecure and must be removed",
        )

    def test_allowed_hosts_reads_django_allowed_hosts_env_var(self):
        self.assertIn(
            'DJANGO_ALLOWED_HOSTS',
            _read(_SETTINGS_FILE),
            'settings.py must read ALLOWED_HOSTS from the DJANGO_ALLOWED_HOSTS env var',
        )


class StaticFilesSettingsTest(SimpleTestCase):
    """STATIC_ROOT and an absolute STATIC_URL must appear in settings.py."""

    def test_static_root_is_defined(self):
        self.assertIn(
            'STATIC_ROOT',
            _read(_SETTINGS_FILE),
            'STATIC_ROOT must be defined so collectstatic has a target directory',
        )

    def test_static_url_is_absolute(self):
        self.assertIn(
            "STATIC_URL = '/static/'",
            _read(_SETTINGS_FILE),
            "STATIC_URL must be the absolute '/static/', not the relative 'static/'",
        )


class ReverseProxySettingsFileTest(SimpleTestCase):
    """USE_X_FORWARDED_HOST and SECURE_PROXY_SSL_HEADER must appear in settings.py."""

    def test_use_x_forwarded_host_line_present(self):
        self.assertIn(
            'USE_X_FORWARDED_HOST = True',
            _read(_SETTINGS_FILE),
        )

    def test_secure_proxy_ssl_header_line_present(self):
        self.assertIn(
            'SECURE_PROXY_SSL_HEADER',
            _read(_SETTINGS_FILE),
        )


class GunicornRequirementTest(SimpleTestCase):
    """gunicorn must appear in requirements.txt for the production start command."""

    def test_gunicorn_in_requirements_txt(self):
        lines = [
            line.strip().lower()
            for line in _read(_REQUIREMENTS_FILE).splitlines()
            if line.strip()
        ]
        self.assertTrue(
            any(line.startswith('gunicorn') for line in lines),
            'gunicorn>=22.0 must be listed in requirements.txt',
        )


# ---------------------------------------------------------------------------
# Runtime settings tests (check the loaded settings object)
# ---------------------------------------------------------------------------

class LoadedStaticRootTest(SimpleTestCase):
    """settings.STATIC_ROOT must exist and point to a 'staticfiles' directory."""

    def test_static_root_is_not_none(self):
        self.assertIsNotNone(
            settings.STATIC_ROOT,
            'settings.STATIC_ROOT is not configured (Django default is None)',
        )

    def test_static_root_directory_name(self):
        self.assertEqual(
            settings.STATIC_ROOT.name,
            'staticfiles',
        )


class LoadedReverseProxyTest(SimpleTestCase):
    """The loaded settings must carry the reverse-proxy configuration."""

    def test_use_x_forwarded_host_is_true(self):
        self.assertTrue(
            getattr(settings, 'USE_X_FORWARDED_HOST', False),
            'settings.USE_X_FORWARDED_HOST must be True',
        )

    def test_secure_proxy_ssl_header_value(self):
        self.assertEqual(
            getattr(settings, 'SECURE_PROXY_SSL_HEADER', None),
            ('HTTP_X_FORWARDED_PROTO', 'https'),
        )
