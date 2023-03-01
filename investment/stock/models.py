from django.db import models

from investment.account.models import User
from investment.core.models import CreateUpdateDateModel
from . import Frequency, TradeType


class Company(models.Model):
    stock_id = models.CharField(max_length=32, primary_key=True)
    name = models.CharField(max_length=32, blank=False, null=False)
    trade_type = models.CharField(max_length=4, choices=TradeType.CHOICES, null=True)

    class Meta:
        db_table = "company"

    def __str__(self):
        return f"{self.name}({self.stock_id})"


class StockInfo(CreateUpdateDateModel):
    company = models.OneToOneField(
        Company, on_delete=models.CASCADE, related_name="stock_info", db_index=True
    )
    date = models.DateField()
    quantity = models.BigIntegerField()
    close_price = models.FloatField()
    fluct_price = models.FloatField()

    class Meta:
        db_table = "stock_info"

    def __str__(self):
        return f"{self.company.pk}({self.date})"


class History(models.Model):
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="history", db_index=True
    )
    frequency = models.CharField(
        max_length=8,
        choices=Frequency.CHOICES,
        null=False,
        default=Frequency.DAILY,
        db_index=True,
    )
    date = models.DateField()
    quantity = models.BigIntegerField()
    close_price = models.FloatField()
    fluct_price = models.FloatField()

    class Meta:
        db_table = "history"
        unique_together = [["company", "frequency", "date"]]

    def __str__(self):
        return f"{self.company.pk}({self.date}-{self.frequency})"


class TradeRecord(CreateUpdateDateModel):
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="trade_records", db_index=True
    )
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    deal_time = models.DateField()
    deal_price = models.FloatField()
    deal_quantity = models.BigIntegerField()
    handling_fee = models.BigIntegerField()

    class Meta:
        db_table = "trade_record"

    def __str__(self):
        return f"{self.owner.username}_{self.deal_time}_{self.company.pk}"


class CashDividendRecord(CreateUpdateDateModel):
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="cash_dividend_records",
        db_index=True,
    )
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    deal_time = models.DateField()
    cash_dividend = models.BigIntegerField()

    class Meta:
        db_table = "cash_dividend_record"

    def __str__(self):
        return f"{self.owner.username}_{self.deal_time}_{self.company.pk}"
