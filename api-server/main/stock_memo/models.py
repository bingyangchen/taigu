from django.db.models import CASCADE, PROTECT, ForeignKey, TextField

from main.account.models import User
from main.core.models import CreateUpdateDateModel
from main.stock.models import Company


class StockMemo(CreateUpdateDateModel):
    owner: User = ForeignKey(
        User, on_delete=CASCADE, related_name="stock_memos", db_index=False
    )  # type: ignore
    company: Company = ForeignKey(
        Company, on_delete=PROTECT, related_name="memos", db_index=False
    )  # type: ignore
    note = TextField(db_default="")

    class Meta:
        db_table = "stock_memo"
        unique_together = [["owner", "company"]]

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.company.pk}"
