from django.core.management.base import BaseCommand

from main.stock.utils import fetch_and_store_close_info_today


class Command(BaseCommand):
    def handle(self, *args, **options) -> None:
        fetch_and_store_close_info_today()
