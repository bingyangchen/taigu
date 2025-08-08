from datetime import date

from pydantic import BaseModel, ConfigDict

from main.core.cache import BaseCacheManager


class TimeSeriesStockInfoPointData(BaseModel):
    model_config = ConfigDict(strict=True)

    date: date
    price: float
    fluct_price: float


class TimeSeriesStockInfo(BaseModel):
    model_config = ConfigDict(strict=True)

    data: dict[int, TimeSeriesStockInfoPointData]


class TimeSeriesStockInfoCacheManager(BaseCacheManager[TimeSeriesStockInfo]):
    def __init__(self, stock_id: str) -> None:
        super().__init__(stock_id)

    def _gen_cache_key(self) -> str:
        return f"time_series_stock_info:{self.identifier}"

    def set(self, value: TimeSeriesStockInfo, timeout: int) -> None:
        if not isinstance(value, TimeSeriesStockInfo):
            raise TypeError
        super().set(value, timeout)
