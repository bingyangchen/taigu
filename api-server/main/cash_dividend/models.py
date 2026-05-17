from django.db.models import (
    CASCADE,
    PROTECT,
    DateField,
    ForeignKey,
    PositiveBigIntegerField,
)

from main.account.models import User
from main.core.models import CreateUpdateDateModel
from main.market.models import Company


class CashDividendRecord(CreateUpdateDateModel):
    owner: User = ForeignKey(  # type: ignore
        User,
        on_delete=CASCADE,
        related_name="cash_dividend_records",
        db_index=True,
    )
    company: Company = ForeignKey(Company, on_delete=PROTECT, db_index=True)  # type: ignore
    deal_time = DateField()
    cash_dividend = PositiveBigIntegerField()

    class Meta:
        db_table = "cash_dividend_record"

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.deal_time}_{self.company.pk}"
