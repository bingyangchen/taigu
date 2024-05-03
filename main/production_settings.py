from .settings import *  # noqa: F403

DEBUG = False
ALLOWED_HOSTS = [
    "ec2-18-141-180-28.ap-southeast-1.compute.amazonaws.com",
    "trade-smartly.com",
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https?://(localhost|127\.0\.0\.1):300[0-9]$",
    r"^https://trade-smartly\.com$",
]
