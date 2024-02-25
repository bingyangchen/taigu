from .settings import *  # noqa: F403

# SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
ALLOWED_HOSTS = [
    "trade-smartly-backend-51d59e0a00fc.herokuapp.com",  # Heroku
    "ec2-18-141-180-28.ap-southeast-1.compute.amazonaws.com",  # AWS EC2
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https?://(localhost|127\.0\.0\.1):300[0-9]$",
    r"^https://trade-smartly\.github\.io$",
]
DEBUG = False
