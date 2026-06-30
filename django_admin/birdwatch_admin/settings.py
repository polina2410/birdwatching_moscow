import os
import urllib.parse
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() == 'true'

_DEV_KEY = 'dev-secret-key-change-in-production'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', _DEV_KEY)
if not DEBUG and SECRET_KEY == _DEV_KEY:
    raise ImproperlyConfigured(
        'Set DJANGO_SECRET_KEY to a real secret in production'
    )

_allowed = os.environ.get('DJANGO_ALLOWED_HOSTS', '')
if not DEBUG and not _allowed:
    raise ImproperlyConfigured(
        'DJANGO_ALLOWED_HOSTS must be set when DEBUG is false'
    )
ALLOWED_HOSTS = [h.strip() for h in _allowed.split(',') if h.strip()] if _allowed else ['*']

_DATABASE_URL = os.environ.get('DATABASE_URL')
if not _DATABASE_URL:
    raise ImproperlyConfigured('DATABASE_URL environment variable is not set')

_url = urllib.parse.urlparse(_DATABASE_URL)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': _url.path.lstrip('/'),
        'USER': _url.username,
        'PASSWORD': _url.password or '',
        'HOST': _url.hostname or 'localhost',
        'PORT': str(_url.port or 5432),
    }
}

INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.postgres',
    'birdwatch',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'birdwatch_admin.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'birdwatch_admin.wsgi.application'

LANGUAGE_CODE = 'ru-ru'

TIME_ZONE = 'Europe/Moscow'

USE_I18N = True

USE_TZ = True

USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

MIGRATION_MODULES = {'birdwatch': None}

AUTHENTICATION_BACKENDS = [
    'birdwatch.backends.AppUserAuthBackend',
    'birdwatch.backends.BirdwatchPermissionsBackend',
]

JAZZMIN_SETTINGS = {
    'site_title': 'Birdwatching Moscow Admin',
    'site_header': 'Birdwatching Moscow',
    'custom_css': 'birdwatch/css/admin_custom.css',
    'order_with_respect_to': [
        'birdwatch.walk',
        'birdwatch.expedition',
        'birdwatch.request',
        'birdwatch.appuser',
        'birdwatch.teammember',
    ],
    'hide_apps': ['auth'],
}
