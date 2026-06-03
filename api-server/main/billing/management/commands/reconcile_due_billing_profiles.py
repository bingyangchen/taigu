from django.core.management.base import BaseCommand

from main.billing.services.subscription import (
    expire_all_stale_pending_payments,
    reconcile_due_billing_profiles,
)


class Command(BaseCommand):
    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        expired_payments = expire_all_stale_pending_payments()
        canceled_count = reconcile_due_billing_profiles()
        self.stdout.write(
            self.style.SUCCESS(
                f"Reconciled due billing profiles: canceled {canceled_count}, "
                f"expired pending payments {expired_payments}"
            )
        )
