from django.core.management.base import BaseCommand

from main.billing.services.subscription import renew_due_subscriptions


class Command(BaseCommand):
    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        summary = renew_due_subscriptions()
        self.stdout.write(
            self.style.SUCCESS(
                "Renewed {renewed}, marked past due {past_due}, canceled {canceled}".format(
                    **summary
                )
            )
        )
