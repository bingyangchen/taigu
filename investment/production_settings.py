import dj_database_url
import os

from .settings import *

DATABASES = {
    "default": dj_database_url.config(),
}
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
DEBUG = False
