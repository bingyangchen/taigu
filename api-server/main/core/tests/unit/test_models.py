from datetime import datetime

import pytest
from django.db import models
from django.utils import timezone

from main.core.models import CreateUpdateDateModel
from main.stock.models import Company, StockInfo


@pytest.mark.django_db
class TestCreateUpdateDateModel:
    def test_model_inherits_timestamp_fields(self) -> None:
        model_fields = [field.name for field in StockInfo._meta.fields]

        assert "created_at" in model_fields
        assert "updated_at" in model_fields

    def test_created_at_field_properties(self) -> None:
        created_at_field = StockInfo._meta.get_field("created_at")

        assert isinstance(created_at_field, models.DateTimeField)
        assert created_at_field.auto_now_add is True
        assert created_at_field.auto_now is False

    def test_updated_at_field_properties(self) -> None:
        updated_at_field = StockInfo._meta.get_field("updated_at")

        assert isinstance(updated_at_field, models.DateTimeField)
        assert updated_at_field.auto_now is True
        assert updated_at_field.auto_now_add is False

    def test_model_is_abstract(self) -> None:
        assert CreateUpdateDateModel._meta.abstract is True

    def test_created_at_auto_populated_on_creation(self) -> None:
        before_creation = timezone.now()

        company = Company.objects.create(stock_id="TEST001", name="Test Company")
        instance = StockInfo.objects.create(
            company=company,
            date=timezone.now().date(),
            quantity=1000,
            close_price=100.0,
            fluct_price=5.0,
        )

        after_creation = timezone.now()

        assert instance.created_at is not None
        assert isinstance(instance.created_at, datetime)
        assert before_creation <= instance.created_at <= after_creation

    def test_updated_at_auto_populated_on_creation(self) -> None:
        before_creation = timezone.now()

        company = Company.objects.create(stock_id="TEST002", name="Test Company 2")
        instance = StockInfo.objects.create(
            company=company,
            date=timezone.now().date(),
            quantity=1000,
            close_price=100.0,
            fluct_price=5.0,
        )

        after_creation = timezone.now()

        assert instance.updated_at is not None
        assert isinstance(instance.updated_at, datetime)
        assert before_creation <= instance.updated_at <= after_creation

    def test_created_at_unchanged_on_update(self) -> None:
        company = Company.objects.create(stock_id="TEST003", name="Test Company 3")
        instance = StockInfo.objects.create(
            company=company,
            date=timezone.now().date(),
            quantity=1000,
            close_price=100.0,
            fluct_price=5.0,
        )
        original_created_at = instance.created_at

        # Wait a small amount to ensure timestamp difference
        import time

        time.sleep(0.001)

        instance.close_price = 105.0
        instance.save()
        instance.refresh_from_db()

        assert instance.created_at == original_created_at

    def test_updated_at_changes_on_update(self) -> None:
        company = Company.objects.create(stock_id="TEST004", name="Test Company 4")
        instance = StockInfo.objects.create(
            company=company,
            date=timezone.now().date(),
            quantity=1000,
            close_price=100.0,
            fluct_price=5.0,
        )
        original_updated_at = instance.updated_at

        # Wait a small amount to ensure timestamp difference
        import time

        time.sleep(0.001)

        instance.close_price = 105.0
        instance.save()
        instance.refresh_from_db()

        assert instance.updated_at > original_updated_at

    def test_created_at_and_updated_at_initially_equal(self) -> None:
        company = Company.objects.create(stock_id="TEST005", name="Test Company 5")
        instance = StockInfo.objects.create(
            company=company,
            date=timezone.now().date(),
            quantity=1000,
            close_price=100.0,
            fluct_price=5.0,
        )

        # They should be very close (within milliseconds)
        time_diff = abs((instance.updated_at - instance.created_at).total_seconds())
        assert time_diff < 0.1  # Less than 100ms difference

    def test_multiple_updates_only_affect_updated_at(self) -> None:
        company = Company.objects.create(stock_id="TEST006", name="Test Company 6")
        instance = StockInfo.objects.create(
            company=company,
            date=timezone.now().date(),
            quantity=1000,
            close_price=100.0,
            fluct_price=5.0,
        )
        original_created_at = instance.created_at
        original_updated_at = instance.updated_at

        # First update
        import time

        time.sleep(0.001)
        instance.close_price = 105.0
        instance.save()
        instance.refresh_from_db()

        first_update_time = instance.updated_at
        assert instance.created_at == original_created_at
        assert instance.updated_at > original_updated_at

        # Second update
        time.sleep(0.001)
        instance.close_price = 110.0
        instance.save()
        instance.refresh_from_db()

        assert instance.created_at == original_created_at
        assert instance.updated_at > first_update_time

    def test_bulk_create_populates_timestamps(self) -> None:
        before_bulk_create = timezone.now()

        company1 = Company.objects.create(stock_id="TEST007", name="Test Company 7")
        company2 = Company.objects.create(stock_id="TEST008", name="Test Company 8")
        instances = [
            StockInfo(
                company=company1,
                date=timezone.now().date(),
                quantity=1000,
                close_price=100.0,
                fluct_price=5.0,
            ),
            StockInfo(
                company=company2,
                date=timezone.now().date(),
                quantity=2000,
                close_price=200.0,
                fluct_price=10.0,
            ),
        ]

        created_instances = StockInfo.objects.bulk_create(instances)

        after_bulk_create = timezone.now()

        for instance in created_instances:
            # Refresh from DB to get the actual timestamp values
            instance.refresh_from_db()
            assert instance.created_at is not None
            assert instance.updated_at is not None
            assert before_bulk_create <= instance.created_at <= after_bulk_create
            assert before_bulk_create <= instance.updated_at <= after_bulk_create
