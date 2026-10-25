from django.core.management.base import BaseCommand, CommandError, CommandParser

from main.account.models import User


class Command(BaseCommand):
    help = "Make users superusers, revoke it, or list the superusers."

    def add_arguments(self, parser: CommandParser) -> None:
        subparsers = parser.add_subparsers(dest="subcommand", required=True)
        add_parser = subparsers.add_parser("add", help="Make a user a superuser.")
        add_parser.add_argument("email", help="The user's email.")
        remove_parser = subparsers.add_parser(
            "remove", help="Revoke a user's superuser status."
        )
        remove_parser.add_argument("email", help="The user's email.")
        subparsers.add_parser("list", help="List the superusers.")

    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        match options["subcommand"]:
            case "add":
                self._set_superuser(options["email"], is_superuser=True)
            case "remove":
                self._set_superuser(options["email"], is_superuser=False)
            case "list":
                self._list()

    def _set_superuser(self, email: str, *, is_superuser: bool) -> None:
        if not User.objects.filter(email=email).update(is_superuser=is_superuser):
            raise CommandError(f"No user found for {email}.")
        message = (
            f"Made {email} a superuser."
            if is_superuser
            else f"Revoked superuser from {email}."
        )
        self.stdout.write(self.style.SUCCESS(message))

    def _list(self) -> None:
        for email in (
            User.objects.filter(is_superuser=True)
            .order_by("email")
            .values_list("email", flat=True)
        ):
            self.stdout.write(email)
