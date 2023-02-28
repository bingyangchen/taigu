from django.apps import AppConfig


class StockConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "investment.stock"

    def ready(self):
        from .utils import fetch_stock_info_periodically

        fetch_stock_info_periodically()
