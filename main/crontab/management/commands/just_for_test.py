from datetime import datetime

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    def handle(self, *args, **options) -> None:
        self.stdout.write(f"{datetime.now()} success")
