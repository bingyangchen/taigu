import logging
from pathlib import Path

from main.env import Env, env

logging.basicConfig(
    level=env.LOG_LEVEL,
    format="%(asctime)s \033[1m[%(levelname)s]\033[0m\t%(name)s::%(filename)s:%(lineno)d\n%(message)s\n",
)

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = env.SECRET_KEY
DEBUG = env.ENV == Env.DEV

ALLOWED_HOSTS = ["*"] if env.ENV == Env.DEV else ["api.taigu.tw"]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = (
    ["https://localhost"] if env.ENV == Env.DEV else ["https://taigu.tw"]
)
CSRF_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_DOMAIN = None if env.ENV == Env.DEV else ".taigu.tw"
CSRF_TRUSTED_ORIGINS = (
    ["https://localhost"] if env.ENV == Env.DEV else ["https://taigu.tw"]
)

ROOT_URLCONF = "main.urls"
WSGI_APPLICATION = "main.wsgi.application"
AUTH_USER_MODEL = "account.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

INSTALLED_APPS = [
    # Django
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    # 3rd-party
    "corsheaders",
    # Local
    "main.core",
    "main.account",
    "main.stock",
    "main.memo",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "csp.middleware.CSPMiddleware",
    # Local
    "main.account.middleware.check_login_status_middleware",
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env.DB_NAME,
        "USER": env.DB_USER,
        "PASSWORD": env.DB_PASSWORD,
        "HOST": env.DB_HOST,
        "PORT": env.DB_PORT,
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": f"redis://{env.REDIS_HOST}:{env.REDIS_PORT}",
    }
}

AUTHENTICATION_BACKENDS = [
    "main.account.backends.MyBackend",
    "django.contrib.auth.backends.ModelBackend",
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Taipei"
USE_I18N = True
USE_L10N = True
USE_TZ = True

if env.SQL_LOG:
    LOGGING = {
        "version": 1,
        "disable_existing_loggers": False,
        "handlers": {"console": {"level": "DEBUG", "class": "logging.StreamHandler"}},
        "loggers": {
            "django.db.backends": {
                "handlers": ["console"],
                "level": "DEBUG",
                "propagate": False,
            },
        },
    }
