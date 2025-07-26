import re
from collections.abc import MutableMapping
from typing import Any

import requests
from django.db import models
from pyquery import PyQuery

from main.account.models import User
from main.core.models import CreateUpdateDateModel
from main.stock import Frequency, ThirdPartyApi, TradeType, UnknownStockIdError


class CompanyManager(models.Manager):
    def get_or_create(
        self,
        defaults: MutableMapping[str, Any] | None = None,
        **kwargs,  # noqa: ANN003
    ) -> tuple["Company", bool]:
        pk = kwargs.get("pk") or kwargs.get("stock_id")
        if pk is None:
            raise TypeError("missing 1 required argument: 'stock_id' ('pk')")
        try:
            return (self.get(pk=pk), False)
        except self.model.DoesNotExist:
            defaults = (
                CompanyManager.fetch_company_info(pk) if defaults is None else defaults
            )
            return (super().create(pk=pk, **defaults), True)

    @classmethod
    def fetch_company_info(cls, sid: str) -> dict:
        basic_info_response = requests.post(
            f"{ThirdPartyApi.company_info}{sid}", timeout=5
        )
        basic_info_document = PyQuery(basic_info_response.text)
        company_name = basic_info_document.find(
            "tr:nth-child(2)>td:nth-child(4)"
        ).text()
        trade_type = basic_info_document.find("tr:nth-child(2)>td:nth-child(5)").text()
        if company_name:
            business_response = requests.post(
                ThirdPartyApi.company_business,
                data={  # please refer to https://mopsov.twse.com.tw/mops/web/t05st03
                    "co_id": sid,
                    "queryName": "co_id",
                    "inpuType": "co_id",
                    "TYPEK": "all",
                    "encodeURIComponent": 1,
                    "firstin": True,
                    "step": 1,
                    "off": 1,
                },
                timeout=8,
            )
            business = (
                PyQuery(business_response.text)("tr")
                .filter(lambda _, this: PyQuery(this)("th").text() == "主要經營業務")(
                    "td"
                )
                .text()
            )
            return {
                "name": str(company_name),
                "trade_type": TradeType.TRADE_TYPE_ZH_ENG_MAP.get(str(trade_type)),
                "business": re.sub(r"\s+", "", str(business)),
            }
        else:
            raise UnknownStockIdError("Unknown Stock ID")


class Company(models.Model):
    stock_id = models.CharField(max_length=32, primary_key=True)
    name = models.CharField(max_length=32, blank=False, null=False)
    trade_type = models.CharField(max_length=4, choices=TradeType.CHOICES, null=True)
    business = models.TextField(default="")
    objects = CompanyManager()

    class Meta:
        db_table = "company"

    def __str__(self) -> str:
        return f"{self.name}({self.stock_id})"


class StockInfo(CreateUpdateDateModel):
    company = models.OneToOneField(
        Company, on_delete=models.CASCADE, related_name="stock_info", db_index=True
    )
    date = models.DateField(db_index=True)
    quantity = models.BigIntegerField()
    close_price = models.FloatField()
    fluct_price = models.FloatField()

    class Meta:  # type: ignore
        db_table = "stock_info"

    def __str__(self) -> str:
        return f"{self.company.pk}({self.date})"


class MarketIndexPerMinute(CreateUpdateDateModel):
    market = models.CharField(
        max_length=4, choices=TradeType.CHOICES, null=False, db_index=True
    )
    date = models.DateField(null=False, db_index=True)
    number = models.PositiveSmallIntegerField(null=False, db_index=True)
    price = models.FloatField(null=False)
    fluct_price = models.FloatField(null=False)

    class Meta:  # type: ignore
        db_table = "market_index_per_minute"
        unique_together = [["market", "date", "number"]]


class History(CreateUpdateDateModel):
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
    date = models.DateField(db_index=True)
    quantity = models.BigIntegerField()
    close_price = models.FloatField()

    class Meta:  # type: ignore
        db_table = "history"
        unique_together = [["company", "frequency", "date"]]

    def __str__(self) -> str:
        return f"{self.company.pk}({self.date}-{self.frequency})"


class MaterialFact(CreateUpdateDateModel):
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="material_facts", db_index=True
    )
    date_time = models.DateTimeField(null=False)
    title = models.TextField(null=False, default="")
    description = models.TextField(null=False, default="")

    class Meta:  # type: ignore
        db_table = "material_fact"
        unique_together = [["company", "date_time"]]

    def __str__(self) -> str:
        return f"{self.company.pk}({self.date_time})"


class TradeRecord(CreateUpdateDateModel):
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="trade_records", db_index=True
    )
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    deal_time = models.DateField()
    deal_price = models.FloatField()
    deal_quantity = models.BigIntegerField()
    handling_fee = models.BigIntegerField()

    class Meta:  # type: ignore
        db_table = "trade_record"

    def __str__(self) -> str:
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

    class Meta:  # type: ignore
        db_table = "cash_dividend_record"

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.deal_time}_{self.company.pk}"
