from django.db import models

from main.account.models import User
from main.core.models import CreateUpdateDateModel
from main.stock.models import Company


class StockMemo(CreateUpdateDateModel):
    owner: User = models.ForeignKey(  # type: ignore
        User, on_delete=models.CASCADE, related_name="stock_memos", db_index=True
    )
    company: Company = models.ForeignKey(  # type: ignore
        Company, on_delete=models.PROTECT, related_name="memos", db_index=True
    )
    note = models.TextField(db_default="")

    class Meta:
        db_table = "stock_memo"
        unique_together = [["owner", "company"]]

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.company.pk}"


class TradePlan(CreateUpdateDateModel):
    owner: User = models.ForeignKey(  # type: ignore
        User, on_delete=models.CASCADE, related_name="trade_plans", db_index=True
    )
    company: Company = models.ForeignKey(  # type: ignore
        Company, on_delete=models.PROTECT
    )
    plan_type = models.CharField(max_length=32)
    target_price = models.FloatField()
    target_quantity = models.BigIntegerField()

    class Meta:
        db_table = "trade_plan"

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.company.pk}_${self.target_price}_{self.plan_type}_{self.target_quantity}"  # noqa 1501


class Favorite(CreateUpdateDateModel):
    owner: User = models.ForeignKey(  # type: ignore
        User, on_delete=models.CASCADE, related_name="favorites"
    )
    company: Company = models.ForeignKey(  # type: ignore
        Company, on_delete=models.PROTECT, related_name="followers", db_index=True
    )

    class Meta:
        db_table = "favorite"
        unique_together = [["owner", "company"]]

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.company.pk}"
