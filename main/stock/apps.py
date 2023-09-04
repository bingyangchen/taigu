from django.apps import AppConfig


class StockConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "main.stock"

    def ready(self):
        from .utils import set_up_cron_jobs

        set_up_cron_jobs()
