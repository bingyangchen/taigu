from django.core.management.base import BaseCommand

from main.stock.services import fetch_and_store_close_info_today


class Command(BaseCommand):
    """This command is currently not used."""

    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        fetch_and_store_close_info_today()
