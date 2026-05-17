from django.db.models import (
    CASCADE,
    PROTECT,
    BigIntegerField,
    DateField,
    FloatField,
    ForeignKey,
    PositiveBigIntegerField,
)

from main.account.models import User
from main.core.models import CreateUpdateDateModel
from main.market.models import Company


class TradeRecord(CreateUpdateDateModel):
    owner: User = ForeignKey(  # type: ignore
        User, on_delete=CASCADE, related_name="trade_records", db_index=True
    )
    company: Company = ForeignKey(Company, on_delete=PROTECT, db_index=True)  # type: ignore
    deal_time = DateField()
    deal_price = FloatField()
    deal_quantity = BigIntegerField()
    handling_fee = PositiveBigIntegerField()

    class Meta:
        db_table = "trade_record"

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.deal_time}_{self.company.pk}"
