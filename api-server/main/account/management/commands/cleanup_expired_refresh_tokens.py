from django.core.management.base import BaseCommand

from main.account.services.tokens import delete_expired_refresh_tokens


class Command(BaseCommand):
    help = "Delete expired refresh tokens."

    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        deleted_count = delete_expired_refresh_tokens()
        self.stdout.write(f"Deleted {deleted_count} expired refresh tokens.")
