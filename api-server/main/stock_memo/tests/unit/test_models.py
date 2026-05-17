from datetime import datetime
from typing import Any

import pytest
from django.db import IntegrityError
from django.db.models.deletion import ProtectedError

from main.account.models import User
from main.stock.models import Company
from main.stock_memo.models import StockMemo


@pytest.mark.django_db
class TestStockMemoModel:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create(
            oauth_org="google",
            oauth_id="test_user",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(
            stock_id="2330", name="台積電", trade_type="tse", business="Semiconductor"
        )

    @pytest.fixture
    def stock_memo_data(self, user: User, company: Company) -> dict[str, Any]:
        return {"owner": user, "company": company, "note": "This is a test memo"}

    def test_stock_memo_creation(self, stock_memo_data: dict[str, Any]) -> None:
        memo = StockMemo.objects.create(**stock_memo_data)

        assert memo.owner == stock_memo_data["owner"]
        assert memo.company == stock_memo_data["company"]
        assert memo.note == stock_memo_data["note"]
        assert isinstance(memo.created_at, datetime)
        assert isinstance(memo.updated_at, datetime)

    def test_stock_memo_meta_options(self) -> None:
        assert StockMemo._meta.app_label == "stock_memo"
        assert StockMemo._meta.db_table == "stock_memo"
        assert ("owner", "company") in StockMemo._meta.unique_together

    def test_stock_memo_unique_constraint(self, user: User, company: Company) -> None:
        StockMemo.objects.create(owner=user, company=company, note="First memo")

        with pytest.raises(IntegrityError):
            StockMemo.objects.create(owner=user, company=company, note="Second memo")

    def test_stock_memo_relationships(
        self, user: User, company: Company, stock_memo_data: dict[str, Any]
    ) -> None:
        memo = StockMemo.objects.create(**stock_memo_data)

        assert memo in user.stock_memos.all()
        assert memo in company.memos.all()

    def test_stock_memo_cascade_on_user_delete(
        self, user: User, company: Company
    ) -> None:
        memo = StockMemo.objects.create(owner=user, company=company, note="Test")
        memo_id = memo.id

        user.delete()

        assert not StockMemo.objects.filter(id=memo_id).exists()

    def test_stock_memo_protect_on_company_delete(
        self, user: User, company: Company
    ) -> None:
        StockMemo.objects.create(owner=user, company=company, note="Test")

        with pytest.raises(ProtectedError):
            company.delete()
