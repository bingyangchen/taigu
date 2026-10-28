import uuid

from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.utils import timezone

from main.account.models import User
from main.billing.models import BillingProfile, StandardWhitelist, SubscriptionStatus


class Command(BaseCommand):
    help = "Add users to, remove users from, or list the Standard whitelist."

    def add_arguments(self, parser: CommandParser) -> None:
        subparsers = parser.add_subparsers(dest="subcommand", required=True)
        add_parser = subparsers.add_parser("add", help="Add a user to the whitelist.")
        add_parser.add_argument("user", help="The user's email or user id.")
        add_parser.add_argument("--note", default="", help="Why the user is added.")
        remove_parser = subparsers.add_parser(
            "remove", help="Remove a user from the whitelist."
        )
        remove_parser.add_argument("user", help="The user's email or user id.")
        subparsers.add_parser("list", help="List the users on the whitelist.")

    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        match options["subcommand"]:
            case "add":
                self._add(options["user"], options["note"])
            case "remove":
                self._remove(options["user"])
            case "list":
                self._list()

    def _add(self, user_identifier: str, note: str) -> None:
        user = _get_user(user_identifier)
        _, created = StandardWhitelist.objects.get_or_create(
            user=user, defaults={"note": note}
        )
        if not created:
            raise CommandError(f"{user.email} is already on the Standard whitelist.")
        self.stdout.write(
            self.style.SUCCESS(f"Added {user.email} to the Standard whitelist.")
        )

        profile = BillingProfile.objects.filter(user=user).first()
        if profile is None or profile.cancel_at_period_end:
            return
        if profile.subscription_status == SubscriptionStatus.ACTIVE:
            self.stdout.write(
                self.style.WARNING(
                    "The user's subscription is auto-renewing, so ECPay will keep "
                    "charging the user. Ask the user to stop auto-renewal on the plan "
                    "page."
                )
            )

    def _remove(self, user_identifier: str) -> None:
        user = _get_user(user_identifier)
        deleted_count, _ = StandardWhitelist.objects.filter(user=user).delete()
        if deleted_count == 0:
            raise CommandError(f"{user.email} is not on the Standard whitelist.")
        self.stdout.write(
            self.style.SUCCESS(f"Removed {user.email} from the Standard whitelist.")
        )

    def _list(self) -> None:
        entries = StandardWhitelist.objects.select_related("user").order_by(
            "created_at"
        )
        self.stdout.write(
            "\t".join(["user_id", "email", "username", "note", "added_at"])
        )
        for entry in entries:
            added_at = timezone.localtime(entry.created_at).strftime("%Y-%m-%d %H:%M")
            self.stdout.write(
                "\t".join(
                    [
                        str(entry.user.id),
                        entry.user.email,
                        entry.user.username,
                        entry.note,
                        added_at,
                    ]
                )
            )


def _get_user(user_identifier: str) -> User:
    if "@" in user_identifier:
        user = User.objects.filter(email=user_identifier).first()
    else:
        try:
            user_id = uuid.UUID(user_identifier)
        except ValueError:
            raise CommandError(
                f"{user_identifier} is neither an email nor a user id."
            ) from None
        user = User.objects.filter(id=user_id).first()
    if user is None:
        raise CommandError(f"No user found for {user_identifier}.")
    return user
