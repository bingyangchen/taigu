from django.db.models import (
    CASCADE,
    PROTECT,
    BigIntegerField,
    CharField,
    FloatField,
    ForeignKey,
    TextField,
)

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


class TradePlan(CreateUpdateDateModel):
    owner: User = ForeignKey(  # type: ignore
        User, on_delete=CASCADE, related_name="trade_plans", db_index=True
    )
    company: Company = ForeignKey(Company, on_delete=PROTECT, db_index=True)  # type: ignore
    plan_type = CharField(max_length=32)
    target_price = FloatField()
    target_quantity = BigIntegerField()

    class Meta:
        db_table = "trade_plan"

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.company.pk}_${self.target_price}_{self.plan_type}_{self.target_quantity}"  # noqa 1501


class Favorite(CreateUpdateDateModel):
    owner: User = ForeignKey(
        User, on_delete=CASCADE, related_name="favorites", db_index=False
    )  # type: ignore
    company: Company = ForeignKey(  # type: ignore
        Company, on_delete=PROTECT, related_name="followers", db_index=False
    )

    class Meta:
        db_table = "favorite"
        unique_together = [["owner", "company"]]

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.company.pk}"
