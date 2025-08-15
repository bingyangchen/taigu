from datetime import datetime

import pytest
from django.db import models
from django.utils import timezone

from main.core.models import CreateUpdateDateModel
from main.stock.models import Company, StockInfo


@pytest.mark.django_db
class TestCreateUpdateDateModel:
    def test_model_is_abstract(self) -> None:
        """Test that CreateUpdateDateModel is abstract."""
        assert CreateUpdateDateModel._meta.abstract is True

    def test_model_inherits_timestamp_fields(self) -> None:
        """Test that concrete models inherit the timestamp fields."""
        model_fields = [field.name for field in StockInfo._meta.fields]
        assert "created_at" in model_fields
        assert "updated_at" in model_fields

    def test_timestamp_field_properties(self) -> None:
        """Test that timestamp fields have correct Django field properties."""
        created_at_field = StockInfo._meta.get_field("created_at")
        updated_at_field = StockInfo._meta.get_field("updated_at")

        # created_at field properties
        assert isinstance(created_at_field, models.DateTimeField)
        assert created_at_field.auto_now_add is True
        assert created_at_field.auto_now is False

        # updated_at field properties
        assert isinstance(updated_at_field, models.DateTimeField)
        assert updated_at_field.auto_now is True
        assert updated_at_field.auto_now_add is False

    def test_timestamp_behavior(self) -> None:
        """Test basic timestamp behavior on creation and update."""
        company = Company.objects.create(stock_id="TEST001", name="Test Company")

        # Test creation
        instance = StockInfo.objects.create(
            company=company,
            date=timezone.now().date(),
            quantity=1000,
            close_price=100.0,
            fluct_price=5.0,
        )

        assert instance.created_at is not None
        assert instance.updated_at is not None
        assert isinstance(instance.created_at, datetime)
        assert isinstance(instance.updated_at, datetime)

        # Test that created_at and updated_at are initially equal
        time_diff = abs((instance.updated_at - instance.created_at).total_seconds())
        assert time_diff < 0.1  # Less than 100ms difference

        # Test update behavior
        original_created_at = instance.created_at
        original_updated_at = instance.updated_at

        instance.close_price = 105.0
        instance.save()
        instance.refresh_from_db()

        # created_at should remain unchanged
        assert instance.created_at == original_created_at
        # updated_at should be newer
        assert instance.updated_at > original_updated_at
