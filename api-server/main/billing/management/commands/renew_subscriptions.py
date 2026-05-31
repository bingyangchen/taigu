from django.core.management.base import BaseCommand

from main.billing.services.subscription import (
    expire_all_stale_pending_payments,
    renew_due_subscriptions,
)


class Command(BaseCommand):
    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        expired_payments = expire_all_stale_pending_payments()
        summary = renew_due_subscriptions()
        self.stdout.write(
            self.style.SUCCESS(
                "Renewed {renewed}, marked past due {past_due}, canceled {canceled}, "
                "expired pending payments {expired_payments}".format(
                    **summary, expired_payments=expired_payments
                )
            )
        )
