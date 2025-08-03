from django.apps import AppConfig


class CrontabConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"  # type: ignore
    name = "main.crontab"
