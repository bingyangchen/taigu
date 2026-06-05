from django.db.models import CASCADE, ForeignKey, TextField

from main.account.models import User
from main.core.models import CreateUpdateDateModel

BODY_MAX_LENGTH = 5000


class IssueReport(CreateUpdateDateModel):
    user: User = ForeignKey(
        User, on_delete=CASCADE, related_name="issue_reports", db_index=True
    )  # type: ignore
    body = TextField(max_length=BODY_MAX_LENGTH)

    class Meta:
        db_table = "issue_report"

    def __str__(self) -> str:
        return f"{self.user_id}_{self.pk}"
