from django.db.models import (
    CASCADE,
    DateField,
    ForeignKey,
    PositiveBigIntegerField,
    TextField,
)

from main.account.models import User
from main.core.models import CreateUpdateDateModel


class HandlingFeeDiscountRecord(CreateUpdateDateModel):
    owner: User = ForeignKey(  # type: ignore
        User,
        on_delete=CASCADE,
        related_name="handling_fee_discount_records",
        db_index=True,
    )
    amount = PositiveBigIntegerField()
    date = DateField(db_index=True)
    memo = TextField(db_default="")

    class Meta:
        db_table = "handling_fee_discount_record"
