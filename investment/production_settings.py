import dj_database_url

from .settings import *  # noqa: F403

DATABASES = {"default": dj_database_url.config()}

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

ALLOWED_HOSTS = ["trade-smartly-backend-51d59e0a00fc.herokuapp.com"]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https?://(localhost|127\.0\.0\.1):300[0-9]$",
    r"^https://trade-smartly\.github\.io$",
]

DEBUG = False
