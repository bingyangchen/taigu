from django.core.management.base import BaseCommand, CommandError

from main.market.services import backfill_all_stocks_history


class Command(BaseCommand):
    help = "Fill in the daily closes missing from the retention period. Safe to rerun."

    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        if failures := backfill_all_stocks_history():
            raise CommandError(
                "Could not fetch these closes; run the command again: "
                + ", ".join(f"{market} {day}" for market, day in failures)
            )
