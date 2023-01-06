from django.db import models

from investment.core.models import CreateUpdateDateModel
from investment.account.models import user
from investment.stock.models import company


class stock_memo(CreateUpdateDateModel):
    owner = models.ForeignKey(
        user, on_delete=models.CASCADE, related_name="stock_memos"
    )
    company = models.OneToOneField(company, on_delete=models.PROTECT)
    business = models.TextField(default="")
    strategy = models.TextField(default="")
    note = models.TextField(default="")

    def __str__(self):
        return f"{self.owner.username}_{self.company.pk}"


class trade_plan(CreateUpdateDateModel):
    owner = models.ForeignKey(
        user, on_delete=models.CASCADE, related_name="trade_plans"
    )
    company = models.ForeignKey(company, on_delete=models.PROTECT)
    plan_type = models.CharField(max_length=32)
    target_price = models.FloatField()
    target_quantity = models.BigIntegerField()

    def __str__(self):
        return f"{self.owner.username}_{self.company.pk}_${self.target_price}_{self.plan_type}_{self.target_quantity}"
