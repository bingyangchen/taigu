from django.core.management.base import BaseCommand

from main.stock.services import fetch_and_store_realtime_stock_info


class Command(BaseCommand):
    def handle(self, *args, **options) -> None:
        fetch_and_store_realtime_stock_info()
