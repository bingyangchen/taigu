import dj_database_url
from .settings import *
import os

# heroku使用的資料庫為PostgreSQL，所以要修改資料庫設定
DATABASES = {
    "default": dj_database_url.config(),
}
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
ALLOWED_HOSTS = ["*"]
DEBUG = False
