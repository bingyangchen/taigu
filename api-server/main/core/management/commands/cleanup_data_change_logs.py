from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import OuterRef, Subquery
from django.utils import timezone

from main.core.models import DataChangeLog


class Command(BaseCommand):
    help = "Delete data change logs older than the retention window."

    def add_arguments(self, parser) -> None:  # noqa: ANN001
        parser.add_argument("--days", type=int, default=90)

    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        cutoff = timezone.now() - timedelta(days=options["days"])
        latest_log_ids = (
            DataChangeLog.objects.filter(
                user=OuterRef("user"),
                subject=OuterRef("subject"),
            )
            .order_by("-revision")
            .values("id")[:1]
        )
        deleted_count, _ = (
            DataChangeLog.objects.filter(created_at__lt=cutoff)
            .exclude(id__in=Subquery(latest_log_ids))
            .delete()
        )
        self.stdout.write(f"Deleted {deleted_count} data change logs.")
