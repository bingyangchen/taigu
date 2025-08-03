from django.apps import AppConfig


class MemoConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"  # type: ignore
    name = "main.memo"
