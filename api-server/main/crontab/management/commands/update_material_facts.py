from django.core.management.base import BaseCommand

from main.stock.services import update_material_facts


class Command(BaseCommand):
    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        update_material_facts()
