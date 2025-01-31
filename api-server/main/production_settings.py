from .settings import *  # noqa: F403

DEBUG = False
ALLOWED_HOSTS = ["trade-smartly.com"]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https?://(localhost|127\.0\.0\.1):300[0-9]$",
    r"^https://trade-smartly\.com$",
]

if "django_extensions" in INSTALLED_APPS:
    INSTALLED_APPS.remove("django_extensions")
