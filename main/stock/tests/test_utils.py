import time

import pytest

from .. import UnknownStockIdError
from ..utils import fetch_company_info


def test_fetch_company_info():
    assert fetch_company_info("2330") == {"name": "台積電", "trade_type": "tse"}
    time.sleep(0.5)
    with pytest.raises(UnknownStockIdError):
        fetch_company_info("23300")
