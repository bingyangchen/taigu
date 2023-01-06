from django.db import models

from investment.account.models import user
from investment.core.models import CreateUpdateDateModel


class company(models.Model):
    stock_id = models.CharField(max_length=32, primary_key=True)
    name = models.CharField(max_length=32, unique=True)

    def __str__(self):
        return f"{self.name}({self.stock_id})"


class stock_info(CreateUpdateDateModel):
    company = models.OneToOneField(company, on_delete=models.PROTECT)
    date = models.DateField()
    trade_type = models.CharField(max_length=32)
    quantity = models.BigIntegerField()
    open_price = models.FloatField()
    close_price = models.FloatField()
    highest_price = models.FloatField()
    lowest_price = models.FloatField()
    fluct_price = models.FloatField()
    fluct_rate = models.FloatField()

    def __str__(self):
        return f"{self.date}_{self.company.stock_id}"


class trade_record(CreateUpdateDateModel):
    owner = models.ForeignKey(
        user, on_delete=models.CASCADE, related_name="trade_records"
    )
    company = models.ForeignKey(company, on_delete=models.PROTECT)
    deal_time = models.DateField()
    deal_price = models.FloatField()
    deal_quantity = models.BigIntegerField()
    handling_fee = models.BigIntegerField()

    def __str__(self):
        return f"{self.owner.username}_{self.deal_time}_{self.company.pk}"


class cash_dividend_record(CreateUpdateDateModel):
    owner = models.ForeignKey(
        user, on_delete=models.CASCADE, related_name="cash_dividend_records"
    )
    company = models.ForeignKey(company, on_delete=models.PROTECT)
    deal_time = models.DateField()
    cash_dividend = models.BigIntegerField()

    def __str__(self):
        return f"{self.owner.username}_{self.deal_time}_{self.company.pk}"


# class stock_memo(CreateUpdateDateModel):
#     owner = models.ForeignKey(
#         user, on_delete=models.CASCADE, related_name="stock_memos"
#     )
#     company = models.OneToOneField(company, on_delete=models.PROTECT)
#     business = models.CharField(max_length=2048)
#     strategy = models.CharField(max_length=128)
#     note = models.CharField(max_length=4096)

#     def __str__(self):
#         return f"{self.owner.username}_{self.company.pk}"


# class trade_plan(CreateUpdateDateModel):
#     owner = models.ForeignKey(
#         user, on_delete=models.CASCADE, related_name="trade_plans"
#     )
#     company = models.ForeignKey(company, on_delete=models.PROTECT)
#     plan_type = models.CharField(max_length=32)
#     target_price = models.FloatField()
#     target_quantity = models.BigIntegerField()

#     def __str__(self):
#         return f"{self.owner.username}_{self.company.pk}_${self.target_price}_{self.plan_type}_{self.target_quantity}"
