import logging
import re
from collections.abc import MutableMapping
from typing import Any

import requests
import urllib3
from django.db.models import (
    CASCADE,
    PROTECT,
    BigIntegerField,
    CharField,
    DateField,
    DateTimeField,
    FloatField,
    ForeignKey,
    Manager,
    Model,
    OneToOneField,
    PositiveSmallIntegerField,
    TextField,
)
from pyquery import PyQuery

from main.account.models import User
from main.core.models import CreateUpdateDateModel
from main.stock import Frequency, ThirdPartyApi, TradeType, UnknownStockIdError

logger = logging.getLogger(__name__)


class CompanyManager(Manager):
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
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        basic_info_response = requests.post(
            f"{ThirdPartyApi.company_info}{sid}",
            timeout=5,
            verify=False,  # noqa: S501
        )
        basic_info_document = PyQuery(basic_info_response.text)
        company_name = basic_info_document.find(
            "tr:nth-child(2)>td:nth-child(4)"
        ).text()
        trade_type = basic_info_document.find("tr:nth-child(2)>td:nth-child(5)").text()
        trade_type = TradeType.TRADE_TYPE_ZH_ENG_MAP.get(str(trade_type))
        if company_name and trade_type:
            business = ""
            try:
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
                    verify=False,  # noqa: S501
                )
                business = (
                    PyQuery(business_response.text)("tr")
                    .filter(
                        lambda _, this: PyQuery(this)("th").text() == "主要經營業務"
                    )("td")
                    .text()
                )
            except Exception:
                logger.error(f"Failed to fetch business for {sid}")

            return {
                "name": str(company_name),
                "trade_type": trade_type,
                "business": re.sub(r"\s+", "", str(business)),
            }
        else:
            raise UnknownStockIdError(f"Unknown Stock ID: {sid}")


class Company(Model):
    stock_id = CharField(max_length=32, primary_key=True)
    name = CharField(max_length=32)
    trade_type = CharField(max_length=4, choices=TradeType.CHOICES, null=True)
    business = TextField(db_default="")

    objects = CompanyManager()

    class Meta:
        db_table = "company"

    def __str__(self) -> str:
        return f"{self.name}({self.stock_id})"


class StockInfo(CreateUpdateDateModel):
    company: Company = OneToOneField(  # type: ignore
        Company, on_delete=CASCADE, related_name="stock_info", db_index=True
    )
    date = DateField(db_index=True)
    quantity = BigIntegerField()
    close_price = FloatField()
    fluct_price = FloatField()

    class Meta:
        db_table = "stock_info"

    def __str__(self) -> str:
        return f"{self.company.pk}({self.date})"


class MarketIndexPerMinute(CreateUpdateDateModel):
    market = CharField(max_length=4, choices=TradeType.CHOICES)
    date = DateField(db_index=True)
    number = PositiveSmallIntegerField(db_index=True)
    price = FloatField()
    fluct_price = FloatField()

    class Meta:
        db_table = "market_index_per_minute"
        unique_together = [["market", "date", "number"]]


class History(CreateUpdateDateModel):
    company: Company = ForeignKey(  # type: ignore
        Company, on_delete=CASCADE, related_name="history", db_index=False
    )
    frequency = CharField(max_length=8, choices=Frequency.CHOICES, db_index=True)
    date = DateField(db_index=True)
    quantity = BigIntegerField()
    close_price = FloatField()

    class Meta:
        db_table = "history"
        unique_together = [["company", "frequency", "date"]]

    def __str__(self) -> str:
        return f"{self.company.pk}({self.date}-{self.frequency})"


class MaterialFact(CreateUpdateDateModel):
    company: Company = ForeignKey(  # type: ignore
        Company, on_delete=CASCADE, related_name="material_facts", db_index=False
    )
    date_time = DateTimeField()
    title = TextField(db_default="")
    description = TextField(db_default="")

    class Meta:
        db_table = "material_fact"
        unique_together = [["company", "date_time"]]

    def __str__(self) -> str:
        return f"{self.company.pk}({self.date_time})"


class TradeRecord(CreateUpdateDateModel):
    owner: User = ForeignKey(  # type: ignore
        User, on_delete=CASCADE, related_name="trade_records", db_index=True
    )
    company: Company = ForeignKey(Company, on_delete=PROTECT, db_index=True)  # type: ignore
    deal_time = DateField()
    deal_price = FloatField()
    deal_quantity = BigIntegerField()
    handling_fee = BigIntegerField()

    class Meta:
        db_table = "trade_record"

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.deal_time}_{self.company.pk}"


class CashDividendRecord(CreateUpdateDateModel):
    owner: User = ForeignKey(  # type: ignore
        User,
        on_delete=CASCADE,
        related_name="cash_dividend_records",
        db_index=True,
    )
    company: Company = ForeignKey(Company, on_delete=PROTECT, db_index=True)  # type: ignore
    deal_time = DateField()
    cash_dividend = BigIntegerField()

    class Meta:
        db_table = "cash_dividend_record"

    def __str__(self) -> str:
        return f"{self.owner.username}_{self.deal_time}_{self.company.pk}"
