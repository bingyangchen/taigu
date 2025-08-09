from datetime import UTC, date, datetime, timedelta
from typing import Any
from unittest.mock import Mock, patch

import pytest
from django.db import DataError, IntegrityError

from main.account import OAuthOrganization
from main.account.models import User
from main.stock import Frequency, TradeType, UnknownStockIdError
from main.stock.models import (
    CashDividendRecord,
    Company,
    CompanyManager,
    History,
    MarketIndexPerMinute,
    MaterialFact,
    StockInfo,
    TradeRecord,
)


@pytest.mark.django_db
class TestCompanyManager:
    @pytest.fixture
    def manager(self) -> CompanyManager:
        manager = CompanyManager()
        manager.model = Company
        return manager

    def test_get_or_create_existing_company(self, manager: CompanyManager) -> None:
        # Create a company first
        existing_company = Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Testing business",
        )

        company, created = manager.get_or_create(pk="1234")

        assert not created
        assert company.stock_id == "1234"
        assert company == existing_company

    def test_get_or_create_missing_stock_id(self, manager: CompanyManager) -> None:
        with pytest.raises(TypeError, match="missing 1 required argument: 'stock_id'"):
            manager.get_or_create()

    @patch("main.stock.models.CompanyManager.fetch_company_info")
    def test_get_or_create_new_company(
        self, mock_fetch: Mock, manager: CompanyManager
    ) -> None:
        mock_fetch.return_value = {
            "name": "New Company",
            "trade_type": TradeType.TSE,
            "business": "New business",
        }

        company, created = manager.get_or_create(stock_id="5678")

        assert created
        assert company.stock_id == "5678"
        assert company.name == "New Company"
        assert company.trade_type == TradeType.TSE
        assert company.business == "New business"
        mock_fetch.assert_called_once_with("5678")

    @patch("main.stock.models.CompanyManager.fetch_company_info")
    def test_get_or_create_with_custom_defaults(
        self, mock_fetch: Mock, manager: CompanyManager
    ) -> None:
        mock_fetch.return_value = {
            "name": "Fetched Company",
            "trade_type": TradeType.OTC,
            "business": "Fetched business",
        }

        defaults = {
            "name": "Custom Company",
            "trade_type": TradeType.TSE,
            "business": "Custom business",
        }

        company, created = manager.get_or_create(stock_id="9999", defaults=defaults)

        assert created
        assert company.stock_id == "9999"
        assert company.name == "Custom Company"
        assert company.trade_type == TradeType.TSE
        assert company.business == "Custom business"
        mock_fetch.assert_not_called()

    @patch("requests.post")
    @patch("main.stock.models.PyQuery")
    def test_fetch_company_info_success(
        self, mock_pyquery: Mock, mock_post: Mock
    ) -> None:
        # Mock the basic info response
        mock_basic_response = Mock()
        mock_basic_response.text = "<html>basic info</html>"

        # Mock the business response
        mock_business_response = Mock()
        mock_business_response.text = "<html>business info</html>"

        mock_post.side_effect = [mock_basic_response, mock_business_response]

        # Mock PyQuery responses
        mock_basic_doc = Mock()
        mock_basic_doc.find.side_effect = [
            Mock(text=Mock(return_value="Test Company")),  # company name
            Mock(text=Mock(return_value="上市")),  # trade type
        ]

        mock_business_doc = Mock()
        mock_business_doc.return_value.filter.return_value.return_value.text.return_value = "  Main Business  "

        mock_pyquery.side_effect = [mock_basic_doc, mock_business_doc]

        result = CompanyManager.fetch_company_info("1234")

        assert result == {
            "name": "Test Company",
            "trade_type": TradeType.TSE,
            "business": "MainBusiness",
        }

    @patch("requests.post")
    @patch("main.stock.models.PyQuery")
    def test_fetch_company_info_unknown_stock_id(
        self, mock_pyquery: Mock, mock_post: Mock
    ) -> None:
        mock_response = Mock()
        mock_response.text = "<html></html>"
        mock_post.return_value = mock_response

        mock_doc = Mock()
        mock_doc.find.side_effect = [
            Mock(text=Mock(return_value="")),  # empty company name
            Mock(text=Mock(return_value="上市")),  # trade type
        ]
        mock_pyquery.return_value = mock_doc

        with pytest.raises(UnknownStockIdError, match="Unknown Stock ID: 1234"):
            CompanyManager.fetch_company_info("1234")

    @patch("requests.post")
    @patch("main.stock.models.PyQuery")
    @patch("main.stock.models.logger")
    def test_fetch_company_info_business_request_fails(
        self, mock_logger: Mock, mock_pyquery: Mock, mock_post: Mock
    ) -> None:
        # Mock successful basic info request
        mock_basic_response = Mock()
        mock_basic_response.text = "<html>basic info</html>"

        # Mock failed business request
        mock_post.side_effect = [mock_basic_response, Exception("Network error")]

        # Mock PyQuery for basic info
        mock_basic_doc = Mock()
        mock_basic_doc.find.side_effect = [
            Mock(text=Mock(return_value="Test Company")),
            Mock(text=Mock(return_value="上市")),
        ]
        mock_pyquery.return_value = mock_basic_doc

        result = CompanyManager.fetch_company_info("1234")

        assert result == {
            "name": "Test Company",
            "trade_type": TradeType.TSE,
            "business": "",
        }
        mock_logger.error.assert_called_once_with("Failed to fetch business for 1234")


@pytest.mark.django_db
class TestCompanyModel:
    @pytest.fixture
    def company_data(self) -> dict[str, Any]:
        return {
            "stock_id": "1234",
            "name": "Test Company",
            "trade_type": TradeType.TSE,
            "business": "Test business",
        }

    def test_company_creation(self, company_data: dict[str, Any]) -> None:
        company = Company.objects.create(**company_data)

        assert company.stock_id == "1234"
        assert company.name == "Test Company"
        assert company.trade_type == TradeType.TSE
        assert company.business == "Test business"

    def test_company_str_representation(self, company_data: dict[str, Any]) -> None:
        company = Company.objects.create(**company_data)

        assert str(company) == "Test Company(1234)"

    def test_company_meta_options(self) -> None:
        assert Company._meta.db_table == "company"

    def test_company_primary_key(self, company_data: dict[str, Any]) -> None:
        company = Company.objects.create(**company_data)

        assert company.pk == "1234"
        assert company.stock_id == "1234"

    def test_company_trade_type_choices(self, company_data: dict[str, Any]) -> None:
        # Test TSE
        company_data["trade_type"] = TradeType.TSE
        company = Company.objects.create(**company_data)
        assert company.trade_type == TradeType.TSE

        # Test OTC
        company_data["stock_id"] = "5678"
        company_data["trade_type"] = TradeType.OTC
        company2 = Company.objects.create(**company_data)
        assert company2.trade_type == TradeType.OTC

    def test_company_unique_constraint(self, company_data: dict[str, Any]) -> None:
        Company.objects.create(**company_data)

        with pytest.raises(IntegrityError):
            Company.objects.create(**company_data)

    def test_company_name_max_length(self, company_data: dict[str, Any]) -> None:
        company_data["name"] = "a" * 33  # Exceeds max_length=32

        with pytest.raises((IntegrityError, ValueError, DataError)):
            Company.objects.create(**company_data)

    def test_company_stock_id_max_length(self, company_data: dict[str, Any]) -> None:
        company_data["stock_id"] = "a" * 33  # Exceeds max_length=32

        with pytest.raises((IntegrityError, ValueError, DataError)):
            Company.objects.create(**company_data)


@pytest.mark.django_db
class TestStockInfoModel:
    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
        )

    @pytest.fixture
    def stock_info_data(self, company: Company) -> dict[str, Any]:
        return {
            "company": company,
            "date": date.today(),
            "quantity": 1000000,
            "close_price": 100.5,
            "fluct_price": 2.3,
        }

    def test_stock_info_creation(self, stock_info_data: dict[str, Any]) -> None:
        stock_info = StockInfo.objects.create(**stock_info_data)

        assert stock_info.company.stock_id == "1234"
        assert stock_info.date == date.today()
        assert stock_info.quantity == 1000000
        assert stock_info.close_price == 100.5
        assert stock_info.fluct_price == 2.3

    def test_stock_info_str_representation(
        self, stock_info_data: dict[str, Any]
    ) -> None:
        stock_info = StockInfo.objects.create(**stock_info_data)

        assert str(stock_info) == f"1234({date.today()})"

    def test_stock_info_meta_options(self) -> None:
        assert StockInfo._meta.db_table == "stock_info"

    def test_stock_info_company_relationship(
        self, stock_info_data: dict[str, Any]
    ) -> None:
        stock_info = StockInfo.objects.create(**stock_info_data)

        # Test reverse relationship
        assert stock_info.company.stock_info == stock_info

    def test_stock_info_cascade_delete(self, stock_info_data: dict[str, Any]) -> None:
        company = stock_info_data["company"]
        stock_info = StockInfo.objects.create(**stock_info_data)

        company.delete()

        assert not StockInfo.objects.filter(pk=stock_info.pk).exists()


@pytest.mark.django_db
class TestMarketIndexPerMinuteModel:
    @pytest.fixture
    def market_index_data(self) -> dict[str, Any]:
        return {
            "market": TradeType.TSE,
            "date": date.today(),
            "number": 30,
            "price": 15000.5,
            "fluct_price": 50.2,
        }

    def test_market_index_creation(self, market_index_data: dict[str, Any]) -> None:
        market_index = MarketIndexPerMinute.objects.create(**market_index_data)

        assert market_index.market == TradeType.TSE
        assert market_index.date == date.today()
        assert market_index.number == 30
        assert market_index.price == 15000.5
        assert market_index.fluct_price == 50.2

    def test_market_index_meta_options(self) -> None:
        assert MarketIndexPerMinute._meta.db_table == "market_index_per_minute"
        assert MarketIndexPerMinute._meta.unique_together == (
            ("market", "date", "number"),
        )

    def test_market_index_unique_constraint(
        self, market_index_data: dict[str, Any]
    ) -> None:
        MarketIndexPerMinute.objects.create(**market_index_data)

        with pytest.raises(IntegrityError):
            MarketIndexPerMinute.objects.create(**market_index_data)

    def test_market_index_different_numbers_allowed(
        self, market_index_data: dict[str, Any]
    ) -> None:
        MarketIndexPerMinute.objects.create(**market_index_data)

        market_index_data["number"] = 31
        market_index2 = MarketIndexPerMinute.objects.create(**market_index_data)

        assert market_index2.number == 31


@pytest.mark.django_db
class TestHistoryModel:
    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
        )

    @pytest.fixture
    def history_data(self, company: Company) -> dict[str, Any]:
        return {
            "company": company,
            "frequency": Frequency.DAILY,
            "date": date.today(),
            "quantity": 1000000,
            "close_price": 100.5,
        }

    def test_history_creation(self, history_data: dict[str, Any]) -> None:
        history = History.objects.create(**history_data)

        assert history.company.stock_id == "1234"
        assert history.frequency == Frequency.DAILY
        assert history.date == date.today()
        assert history.quantity == 1000000
        assert history.close_price == 100.5

    def test_history_str_representation(self, history_data: dict[str, Any]) -> None:
        history = History.objects.create(**history_data)

        assert str(history) == f"1234({date.today()}-{Frequency.DAILY})"

    def test_history_meta_options(self) -> None:
        assert History._meta.db_table == "history"
        assert History._meta.unique_together == (("company", "frequency", "date"),)

    def test_history_unique_constraint(self, history_data: dict[str, Any]) -> None:
        History.objects.create(**history_data)

        with pytest.raises(IntegrityError):
            History.objects.create(**history_data)

    def test_history_different_frequencies_allowed(
        self, history_data: dict[str, Any]
    ) -> None:
        History.objects.create(**history_data)

        history_data["frequency"] = Frequency.WEEKLY
        history2 = History.objects.create(**history_data)

        assert history2.frequency == Frequency.WEEKLY

    def test_history_frequency_choices(self, history_data: dict[str, Any]) -> None:
        # Test all frequency choices
        for frequency in [Frequency.DAILY, Frequency.WEEKLY, Frequency.MONTHLY]:
            history_data["frequency"] = frequency
            history_data["date"] = date.today() - timedelta(days=len(Frequency.ALL))
            history = History.objects.create(**history_data)
            assert history.frequency == frequency


@pytest.mark.django_db
class TestMaterialFactModel:
    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
        )

    @pytest.fixture
    def material_fact_data(self, company: Company) -> dict[str, Any]:
        return {
            "company": company,
            "date_time": datetime.now(UTC),
            "title": "Important Announcement",
            "description": "This is an important announcement for shareholders",
        }

    def test_material_fact_creation(self, material_fact_data: dict[str, Any]) -> None:
        material_fact = MaterialFact.objects.create(**material_fact_data)

        assert material_fact.company.stock_id == "1234"
        assert material_fact.title == "Important Announcement"
        assert (
            material_fact.description
            == "This is an important announcement for shareholders"
        )

    def test_material_fact_str_representation(
        self, material_fact_data: dict[str, Any]
    ) -> None:
        material_fact = MaterialFact.objects.create(**material_fact_data)

        assert str(material_fact) == f"1234({material_fact.date_time})"

    def test_material_fact_meta_options(self) -> None:
        assert MaterialFact._meta.db_table == "material_fact"
        assert MaterialFact._meta.unique_together == (("company", "date_time"),)

    def test_material_fact_unique_constraint(
        self, material_fact_data: dict[str, Any]
    ) -> None:
        MaterialFact.objects.create(**material_fact_data)

        with pytest.raises(IntegrityError):
            MaterialFact.objects.create(**material_fact_data)

    def test_material_fact_company_relationship(
        self, material_fact_data: dict[str, Any]
    ) -> None:
        company = material_fact_data["company"]
        material_fact = MaterialFact.objects.create(**material_fact_data)

        # Test reverse relationship
        assert material_fact in company.material_facts.all()


@pytest.mark.django_db
class TestTradeRecordModel:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
        )

    @pytest.fixture
    def trade_record_data(self, user: User, company: Company) -> dict[str, Any]:
        return {
            "owner": user,
            "company": company,
            "deal_time": date.today(),
            "deal_price": 100.5,
            "deal_quantity": 1000,
            "handling_fee": 50,
        }

    def test_trade_record_creation(self, trade_record_data: dict[str, Any]) -> None:
        trade_record = TradeRecord.objects.create(**trade_record_data)

        assert trade_record.owner.username == "testuser"
        assert trade_record.company.stock_id == "1234"
        assert trade_record.deal_time == date.today()
        assert trade_record.deal_price == 100.5
        assert trade_record.deal_quantity == 1000
        assert trade_record.handling_fee == 50

    def test_trade_record_str_representation(
        self, trade_record_data: dict[str, Any]
    ) -> None:
        trade_record = TradeRecord.objects.create(**trade_record_data)

        assert str(trade_record) == f"testuser_{date.today()}_1234"

    def test_trade_record_meta_options(self) -> None:
        assert TradeRecord._meta.db_table == "trade_record"

    def test_trade_record_user_relationship(
        self, trade_record_data: dict[str, Any]
    ) -> None:
        user = trade_record_data["owner"]
        trade_record = TradeRecord.objects.create(**trade_record_data)

        # Test reverse relationship
        assert trade_record in user.trade_records.all()

    def test_trade_record_company_protect_delete(
        self, trade_record_data: dict[str, Any]
    ) -> None:
        company = trade_record_data["company"]
        TradeRecord.objects.create(**trade_record_data)

        # Company deletion should be protected
        with pytest.raises((IntegrityError, Exception)):
            company.delete()

    def test_trade_record_user_cascade_delete(
        self, trade_record_data: dict[str, Any]
    ) -> None:
        user = trade_record_data["owner"]
        trade_record = TradeRecord.objects.create(**trade_record_data)

        user.delete()

        # Trade record should be deleted when user is deleted
        assert not TradeRecord.objects.filter(pk=trade_record.pk).exists()


@pytest.mark.django_db
class TestCashDividendRecordModel:
    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def company(self) -> Company:
        return Company.objects.create(
            stock_id="1234",
            name="Test Company",
            trade_type=TradeType.TSE,
            business="Test business",
        )

    @pytest.fixture
    def cash_dividend_data(self, user: User, company: Company) -> dict[str, Any]:
        return {
            "owner": user,
            "company": company,
            "deal_time": date.today(),
            "cash_dividend": 500,
        }

    def test_cash_dividend_record_creation(
        self, cash_dividend_data: dict[str, Any]
    ) -> None:
        cash_dividend = CashDividendRecord.objects.create(**cash_dividend_data)

        assert cash_dividend.owner.username == "testuser"
        assert cash_dividend.company.stock_id == "1234"
        assert cash_dividend.deal_time == date.today()
        assert cash_dividend.cash_dividend == 500

    def test_cash_dividend_record_str_representation(
        self, cash_dividend_data: dict[str, Any]
    ) -> None:
        cash_dividend = CashDividendRecord.objects.create(**cash_dividend_data)

        assert str(cash_dividend) == f"testuser_{date.today()}_1234"

    def test_cash_dividend_record_meta_options(self) -> None:
        assert CashDividendRecord._meta.db_table == "cash_dividend_record"

    def test_cash_dividend_record_user_relationship(
        self, cash_dividend_data: dict[str, Any]
    ) -> None:
        user = cash_dividend_data["owner"]
        cash_dividend = CashDividendRecord.objects.create(**cash_dividend_data)

        # Test reverse relationship
        assert cash_dividend in user.cash_dividend_records.all()

    def test_cash_dividend_record_company_protect_delete(
        self, cash_dividend_data: dict[str, Any]
    ) -> None:
        company = cash_dividend_data["company"]
        CashDividendRecord.objects.create(**cash_dividend_data)

        # Company deletion should be protected
        with pytest.raises((IntegrityError, Exception)):
            company.delete()

    def test_cash_dividend_record_user_cascade_delete(
        self, cash_dividend_data: dict[str, Any]
    ) -> None:
        user = cash_dividend_data["owner"]
        cash_dividend = CashDividendRecord.objects.create(**cash_dividend_data)

        user.delete()

        # Cash dividend record should be deleted when user is deleted
        assert not CashDividendRecord.objects.filter(pk=cash_dividend.pk).exists()
