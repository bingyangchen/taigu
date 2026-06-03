from django.core.management.base import BaseCommand

from main.billing.services.subscription import (
    expire_stale_pending_payments,
    reconcile_due_billing_profiles,
)


class Command(BaseCommand):
    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        expired_payments = expire_stale_pending_payments()
        billing_profile_updates = reconcile_due_billing_profiles()
        self.stdout.write(
            self.style.SUCCESS(
                "Reconciled due billing profiles: "
                f"updated {billing_profile_updates}, "
                f"expired pending payments {expired_payments}"
            )
        )
