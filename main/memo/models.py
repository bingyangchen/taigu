from django.db import models

from main.account.models import User
from main.core.models import CreateUpdateDateModel
from main.stock.models import Company


class StockMemo(CreateUpdateDateModel):
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="stock_memos", db_index=True
    )
    company = models.OneToOneField(Company, on_delete=models.PROTECT)
    business = models.TextField(default="")
    strategy = models.TextField(default="")
    note = models.TextField(default="")

    class Meta:  # type: ignore
        db_table = "stock_memo"

    def __str__(self):
        return f"{self.owner.username}_{self.company.pk}"


class TradePlan(CreateUpdateDateModel):
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="trade_plans", db_index=True
    )
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    plan_type = models.CharField(max_length=32)
    target_price = models.FloatField()
    target_quantity = models.BigIntegerField()

    class Meta:  # type: ignore
        db_table = "trade_plan"

    def __str__(self):
        return f"{self.owner.username}_{self.company.pk}_${self.target_price}_{self.plan_type}_{self.target_quantity}"  # noqa 1501


class Favorite(CreateUpdateDateModel):
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="favorites", db_index=True
    )
    company = models.ForeignKey(
        Company, on_delete=models.PROTECT, related_name="followers", db_index=True
    )

    class Meta:  # type: ignore
        db_table = "favorite"
        unique_together = [["owner", "company"]]

    def __str__(self):
        return f"{self.owner.username}_{self.company.pk}"
