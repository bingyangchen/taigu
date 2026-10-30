import pytest
from _pytest.monkeypatch import MonkeyPatch

from main.billing.tests.unit.fake_ecpay import STAGE_ECPAY_CONFIG, FakeEcpay


@pytest.fixture
def ecpay(monkeypatch: MonkeyPatch) -> FakeEcpay:
    fake = FakeEcpay()
    monkeypatch.setattr("main.billing.services.ecpay.requests.post", fake.post)
    monkeypatch.setattr(
        "main.billing.services.ecpay.get_ecpay_config", lambda: STAGE_ECPAY_CONFIG
    )
    return fake
