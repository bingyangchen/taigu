from django.db.models import CASCADE, BigIntegerField, DateField, ForeignKey, TextField

from main.account.models import User
from main.core.models import CreateUpdateDateModel


class HandlingFeeDiscountRecord(CreateUpdateDateModel):
    owner: User = ForeignKey(  # type: ignore
        User,
        on_delete=CASCADE,
        related_name="handling_fee_discount_records",
        db_index=True,
    )
    amount = BigIntegerField()
    date = DateField(db_index=True)
    memo = TextField(db_default="")

    class Meta:
        db_table = "handling_fee_discount_record"
