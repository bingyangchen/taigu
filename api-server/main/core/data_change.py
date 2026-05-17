from django.db import transaction

from main.account.models import User
from main.core.models import DataChangeLog


def append_data_change_log(
    *,
    user: User,
    subject: DataChangeLog.Subject,
    subject_id: str | int,
    operation: DataChangeLog.Operation,
) -> DataChangeLog:
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        last_revision = get_last_revision(user=user, subject=subject)
        return DataChangeLog.objects.create(
            user=user,
            subject=subject,
            subject_id=str(subject_id),
            revision=last_revision + 1,
            operation=operation,
        )


def get_last_revision(*, user: User, subject: DataChangeLog.Subject) -> int:
    return (
        DataChangeLog.objects.filter(user=user, subject=subject)
        .order_by("-revision")
        .values_list("revision", flat=True)
        .first()
        or 0
    )
