from datetime import date

from pydantic import BaseModel

from main.core.cache import BaseCacheManager


class TimeSeriesStockInfoPointData(BaseModel):
    date: date
    price: float
    fluct_price: float

    class Config:
        strict = True


class TimeSeriesStockInfo(BaseModel):
    data: dict[int, TimeSeriesStockInfoPointData]

    class Config:
        strict = True


class TimeSeriesStockInfoCacheManager(BaseCacheManager[TimeSeriesStockInfo]):
    def __init__(self, stock_id: str) -> None:
        super().__init__(stock_id)

    def _gen_cache_key(self) -> str:
        return f"time_series_stock_info:{self.identifier}"

    def set(self, value: TimeSeriesStockInfo, timeout: int) -> None:
        assert isinstance(value, TimeSeriesStockInfo), TypeError
        super().set(value, timeout)
