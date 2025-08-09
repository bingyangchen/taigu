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
    cache_name = "time_series_stock_info"
    value_validator_model = TimeSeriesStockInfo

    def __init__(self, stock_id: str) -> None:
        super().__init__(stock_id)
