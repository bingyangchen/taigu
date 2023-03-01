from django.db import models

from investment.core.models import CreateUpdateDateModel
from investment.account.models import User
from investment.stock.models import Company


class StockMemo(CreateUpdateDateModel):
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="stock_memos", db_index=True
    )
    company = models.OneToOneField(Company, on_delete=models.PROTECT)
    business = models.TextField(default="")
    strategy = models.TextField(default="")
    note = models.TextField(default="")

    class Meta:
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

    class Meta:
        db_table = "trade_plan"

    def __str__(self):
        return f"{self.owner.username}_{self.company.pk}_${self.target_price}_{self.plan_type}_{self.target_quantity}"
