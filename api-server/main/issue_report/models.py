from django.db.models import CASCADE, CharField, ForeignKey, TextField

from main.account.models import User
from main.core.models import CreateUpdateDateModel
from main.usage.models import Platform

BODY_MAX_LENGTH = 5000


class IssueReport(CreateUpdateDateModel):
    user: User = ForeignKey(
        User, on_delete=CASCADE, related_name="issue_reports", db_index=True
    )  # type: ignore
    body = TextField(max_length=BODY_MAX_LENGTH)
    platform = CharField(max_length=8, choices=Platform.choices, null=True)
    user_agent = TextField(null=True)

    class Meta:
        db_table = "issue_report"

    def __str__(self) -> str:
        return f"{self.user_id}_{self.pk}"
