from django.db.models import (
    CASCADE,
    PROTECT,
    CharField,
    FloatField,
    ForeignKey,
    PositiveBigIntegerField,
)

from main.account.models import User
from main.core.models import CreateUpdateDateModel
from main.market.models import Company


class TradePlan(CreateUpdateDateModel):
    owner: User = ForeignKey(  # type: ignore
        User, on_delete=CASCADE, related_name="trade_plans", db_index=True
    )
    company: Company = ForeignKey(Company, on_delete=PROTECT, db_index=True)  # type: ignore
    plan_type = CharField(max_length=32)
    target_price = FloatField()
    target_quantity = PositiveBigIntegerField()

    class Meta:
        db_table = "trade_plan"

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.company.pk}_${self.target_price}_{self.plan_type}_{self.target_quantity}"  # noqa 1501
