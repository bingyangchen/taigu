from datetime import date

from pydantic import BaseModel, ConfigDict

from main.core.cache import BaseCacheManager


class TimeSeriesStockInfoPointData(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    date: date
    price: float
    fluct_price: float


class TimeSeriesStockInfo(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    data: dict[int, TimeSeriesStockInfoPointData]


class TimeSeriesStockInfoCacheManager(BaseCacheManager[TimeSeriesStockInfo]): ...
