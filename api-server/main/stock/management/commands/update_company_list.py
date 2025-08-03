from django.core.management.base import BaseCommand

from main.stock.services import update_company_list


class Command(BaseCommand):
    """This command is currently not used."""

    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        update_company_list()
