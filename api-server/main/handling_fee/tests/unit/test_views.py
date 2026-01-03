import json
from datetime import date
from json.decoder import JSONDecodeError

import pytest
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpResponseNotAllowed, JsonResponse
from django.test import RequestFactory

from main.account import OAuthOrganization
from main.account.models import User
from main.handling_fee.models import HandlingFeeDiscountRecord
from main.handling_fee.views import (
    _create_discount,
    _delete_discount,
    _list_discounts,
    _update_discount,
    create_or_list_discount,
    update_or_delete_discount,
)


@pytest.mark.django_db
class TestCreateOrListDiscountView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    def test_create_or_list_discount_post_method(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test POST method creates a discount."""
        payload = {
            "date": "2023-12-01",
            "amount": 100,
            "memo": "Test memo",
        }

        request = request_factory.post(
            "/api/handling-fee/discount/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = create_or_list_discount(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "id" in data
        assert data["date"] == "2023-12-01"
        assert data["amount"] == 100
        assert data["memo"] == "Test memo"

    def test_create_or_list_discount_get_method(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test GET method lists discounts."""
        # Create test discounts
        HandlingFeeDiscountRecord.objects.create(
            owner=user, date=date(2023, 12, 1), amount=100, memo="First"
        )
        HandlingFeeDiscountRecord.objects.create(
            owner=user, date=date(2023, 12, 2), amount=200, memo="Second"
        )

        request = request_factory.get("/api/handling-fee/discount/")
        request.user = user

        response = create_or_list_discount(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 2

    def test_create_or_list_discount_invalid_method(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test that invalid HTTP methods return 405."""
        request = request_factory.put("/api/handling-fee/discount/")
        request.user = user

        response = create_or_list_discount(request)

        assert isinstance(response, HttpResponseNotAllowed)
        assert response.status_code == 405


@pytest.mark.django_db
class TestCreateDiscountView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    def test_create_discount_valid(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test creating a discount with valid data."""
        payload = {
            "date": "2023-12-01",
            "amount": 100,
            "memo": "Test memo",
        }

        request = request_factory.post(
            "/api/handling-fee/discount/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _create_discount(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "id" in data
        assert data["date"] == "2023-12-01"
        assert data["amount"] == 100
        assert data["memo"] == "Test memo"

        # Verify record was created in database
        assert HandlingFeeDiscountRecord.objects.filter(
            owner=user, date=date(2023, 12, 1), amount=100
        ).exists()

    def test_create_discount_without_memo(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test creating a discount without memo (should default to empty string)."""
        payload = {
            "date": "2023-12-01",
            "amount": 100,
        }

        request = request_factory.post(
            "/api/handling-fee/discount/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _create_discount(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["memo"] == ""

    def test_create_discount_missing_date(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test creating a discount without date returns 400."""
        payload = {
            "amount": 100,
        }

        request = request_factory.post(
            "/api/handling-fee/discount/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _create_discount(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_create_discount_missing_amount(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test creating a discount without amount returns 400."""
        payload = {
            "date": "2023-12-01",
        }

        request = request_factory.post(
            "/api/handling-fee/discount/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _create_discount(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Data Not Sufficient"

    def test_create_discount_negative_amount(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test creating a discount with negative amount returns 400."""
        payload = {
            "date": "2023-12-01",
            "amount": -100,
        }

        request = request_factory.post(
            "/api/handling-fee/discount/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _create_discount(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Amount must be positive"

    def test_create_discount_zero_amount(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test creating a discount with zero amount (should be valid)."""
        payload = {
            "date": "2023-12-01",
            "amount": 0,
        }

        request = request_factory.post(
            "/api/handling-fee/discount/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _create_discount(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["amount"] == 0

    def test_create_discount_invalid_date_format(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test creating a discount with invalid date format returns 400."""
        payload = {
            "date": "invalid-date",
            "amount": 100,
        }

        request = request_factory.post(
            "/api/handling-fee/discount/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _create_discount(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Invalid Date Format"

    def test_create_discount_wrong_date_format(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test creating a discount with wrong date format returns 400."""
        payload = {
            "date": "12/01/2023",
            "amount": 100,
        }

        request = request_factory.post(
            "/api/handling-fee/discount/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _create_discount(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Invalid Date Format"

    def test_create_discount_invalid_json(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test creating a discount with invalid JSON raises JSONDecodeError."""
        request = request_factory.post(
            "/api/handling-fee/discount/",
            data="invalid json",
            content_type="application/json",
        )
        request.user = user

        with pytest.raises(JSONDecodeError):
            _create_discount(request)


@pytest.mark.django_db
class TestListDiscountsView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def other_user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="other_oauth_id",
            email="other@example.com",
            username="otheruser",
        )

    def test_list_discounts_with_records(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test listing discounts returns user's discounts."""
        # Create test discounts
        HandlingFeeDiscountRecord.objects.create(
            owner=user, date=date(2023, 12, 1), amount=100, memo="First"
        )
        HandlingFeeDiscountRecord.objects.create(
            owner=user, date=date(2023, 12, 2), amount=200, memo="Second"
        )

        request = request_factory.get("/api/handling-fee/discount/")
        request.user = user

        response = _list_discounts(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 2

        # Check data structure
        record = data["data"][0]
        expected_keys = {"id", "date", "amount", "memo"}
        assert set(record.keys()) == expected_keys

        # Check ordering (should be by -date, -created_at)
        assert data["data"][0]["date"] == "2023-12-02"
        assert data["data"][1]["date"] == "2023-12-01"

    def test_list_discounts_empty(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test listing discounts when user has no discounts."""
        request = request_factory.get("/api/handling-fee/discount/")
        request.user = user

        response = _list_discounts(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 0

    def test_list_discounts_only_owner_records(
        self, request_factory: RequestFactory, user: User, other_user: User
    ) -> None:
        """Test that users only see their own discounts."""
        # Create discounts for both users
        HandlingFeeDiscountRecord.objects.create(
            owner=user, date=date(2023, 12, 1), amount=100, memo="User's discount"
        )
        HandlingFeeDiscountRecord.objects.create(
            owner=other_user,
            date=date(2023, 12, 2),
            amount=200,
            memo="Other user's discount",
        )

        request = request_factory.get("/api/handling-fee/discount/")
        request.user = user

        response = _list_discounts(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert "data" in data
        assert len(data["data"]) == 1
        assert data["data"][0]["memo"] == "User's discount"


@pytest.mark.django_db
class TestUpdateOrDeleteDiscountView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def discount(self, user: User) -> HandlingFeeDiscountRecord:
        return HandlingFeeDiscountRecord.objects.create(
            owner=user, date=date(2023, 12, 1), amount=100, memo="Original memo"
        )

    def test_update_or_delete_discount_put_method(
        self,
        request_factory: RequestFactory,
        user: User,
        discount: HandlingFeeDiscountRecord,
    ) -> None:
        """Test PUT method updates a discount."""
        payload = {
            "date": "2023-12-02",
            "amount": 200,
            "memo": "Updated memo",
        }

        request = request_factory.put(
            f"/api/handling-fee/discount/{discount.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = update_or_delete_discount(request, str(discount.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["date"] == "2023-12-02"
        assert data["amount"] == 200
        assert data["memo"] == "Updated memo"

    def test_update_or_delete_discount_delete_method(
        self,
        request_factory: RequestFactory,
        user: User,
        discount: HandlingFeeDiscountRecord,
    ) -> None:
        """Test DELETE method deletes a discount."""
        record_id = discount.pk

        request = request_factory.delete(f"/api/handling-fee/discount/{record_id}/")
        request.user = user

        response = update_or_delete_discount(request, str(record_id))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data == {}

        # Verify record was deleted
        assert not HandlingFeeDiscountRecord.objects.filter(pk=record_id).exists()

    def test_update_or_delete_discount_invalid_method(
        self,
        request_factory: RequestFactory,
        user: User,
        discount: HandlingFeeDiscountRecord,
    ) -> None:
        """Test that invalid HTTP methods return 405."""
        request = request_factory.get(f"/api/handling-fee/discount/{discount.pk}/")
        request.user = user

        response = update_or_delete_discount(request, str(discount.pk))

        assert isinstance(response, HttpResponseNotAllowed)
        assert response.status_code == 405


@pytest.mark.django_db
class TestUpdateDiscountView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def discount(self, user: User) -> HandlingFeeDiscountRecord:
        return HandlingFeeDiscountRecord.objects.create(
            owner=user, date=date(2023, 12, 1), amount=100, memo="Original memo"
        )

    def test_update_discount_all_fields(
        self,
        request_factory: RequestFactory,
        user: User,
        discount: HandlingFeeDiscountRecord,
    ) -> None:
        """Test updating all fields of a discount."""
        payload = {
            "date": "2023-12-02",
            "amount": 200,
            "memo": "Updated memo",
        }

        request = request_factory.put(
            f"/api/handling-fee/discount/{discount.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _update_discount(request, str(discount.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["date"] == "2023-12-02"
        assert data["amount"] == 200
        assert data["memo"] == "Updated memo"

        # Verify database was updated
        discount.refresh_from_db()
        assert discount.date == date(2023, 12, 2)
        assert discount.amount == 200
        assert discount.memo == "Updated memo"

    def test_update_discount_partial_update_date(
        self,
        request_factory: RequestFactory,
        user: User,
        discount: HandlingFeeDiscountRecord,
    ) -> None:
        """Test updating only the date field."""
        payload = {
            "date": "2023-12-05",
        }

        request = request_factory.put(
            f"/api/handling-fee/discount/{discount.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _update_discount(request, str(discount.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["date"] == "2023-12-05"
        assert data["amount"] == 100  # Unchanged
        assert data["memo"] == "Original memo"  # Unchanged

    def test_update_discount_partial_update_amount(
        self,
        request_factory: RequestFactory,
        user: User,
        discount: HandlingFeeDiscountRecord,
    ) -> None:
        """Test updating only the amount field."""
        payload = {
            "amount": 250,
        }

        request = request_factory.put(
            f"/api/handling-fee/discount/{discount.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _update_discount(request, str(discount.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["date"] == "2023-12-01"  # Unchanged
        assert data["amount"] == 250
        assert data["memo"] == "Original memo"  # Unchanged

    def test_update_discount_partial_update_memo(
        self,
        request_factory: RequestFactory,
        user: User,
        discount: HandlingFeeDiscountRecord,
    ) -> None:
        """Test updating only the memo field."""
        payload = {
            "memo": "New memo text",
        }

        request = request_factory.put(
            f"/api/handling-fee/discount/{discount.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _update_discount(request, str(discount.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["date"] == "2023-12-01"  # Unchanged
        assert data["amount"] == 100  # Unchanged
        assert data["memo"] == "New memo text"

    def test_update_discount_empty_payload(
        self,
        request_factory: RequestFactory,
        user: User,
        discount: HandlingFeeDiscountRecord,
    ) -> None:
        """Test updating with empty payload (no changes)."""
        payload = {}

        request = request_factory.put(
            f"/api/handling-fee/discount/{discount.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _update_discount(request, str(discount.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data["date"] == "2023-12-01"  # Unchanged
        assert data["amount"] == 100  # Unchanged
        assert data["memo"] == "Original memo"  # Unchanged

    def test_update_discount_negative_amount(
        self,
        request_factory: RequestFactory,
        user: User,
        discount: HandlingFeeDiscountRecord,
    ) -> None:
        """Test updating with negative amount returns 400."""
        payload = {
            "amount": -50,
        }

        request = request_factory.put(
            f"/api/handling-fee/discount/{discount.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _update_discount(request, str(discount.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Amount must be positive"

    def test_update_discount_invalid_date_format(
        self,
        request_factory: RequestFactory,
        user: User,
        discount: HandlingFeeDiscountRecord,
    ) -> None:
        """Test updating with invalid date format returns 400."""
        payload = {
            "date": "invalid-date",
        }

        request = request_factory.put(
            f"/api/handling-fee/discount/{discount.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        response = _update_discount(request, str(discount.pk))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 400

        data = json.loads(response.content)
        assert data["message"] == "Invalid Date Format"

    def test_update_discount_nonexistent_record(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test updating a non-existent record raises ObjectDoesNotExist."""
        payload = {
            "amount": 200,
        }

        request = request_factory.put(
            "/api/handling-fee/discount/99999/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = user

        with pytest.raises(ObjectDoesNotExist):
            _update_discount(request, "99999")

    def test_update_discount_other_users_record(
        self, request_factory: RequestFactory, discount: HandlingFeeDiscountRecord
    ) -> None:
        """Test updating another user's record raises ObjectDoesNotExist."""
        other_user = User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="other_oauth_id",
            email="other@example.com",
            username="otheruser",
        )

        payload = {
            "amount": 200,
        }

        request = request_factory.put(
            f"/api/handling-fee/discount/{discount.pk}/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        request.user = other_user

        with pytest.raises(ObjectDoesNotExist):
            _update_discount(request, str(discount.pk))

    def test_update_discount_invalid_json(
        self,
        request_factory: RequestFactory,
        user: User,
        discount: HandlingFeeDiscountRecord,
    ) -> None:
        """Test updating a discount with invalid JSON raises JSONDecodeError."""
        request = request_factory.put(
            f"/api/handling-fee/discount/{discount.pk}/",
            data="invalid json",
            content_type="application/json",
        )
        request.user = user

        with pytest.raises(JSONDecodeError):
            _update_discount(request, str(discount.pk))


@pytest.mark.django_db
class TestDeleteDiscountView:
    @pytest.fixture
    def request_factory(self) -> RequestFactory:
        return RequestFactory()

    @pytest.fixture
    def user(self) -> User:
        return User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="test_oauth_id",
            email="test@example.com",
            username="testuser",
        )

    @pytest.fixture
    def discount(self, user: User) -> HandlingFeeDiscountRecord:
        return HandlingFeeDiscountRecord.objects.create(
            owner=user, date=date(2023, 12, 1), amount=100, memo="Test memo"
        )

    def test_delete_discount_success(
        self,
        request_factory: RequestFactory,
        user: User,
        discount: HandlingFeeDiscountRecord,
    ) -> None:
        """Test deleting a discount successfully."""
        record_id = discount.pk

        request = request_factory.delete(f"/api/handling-fee/discount/{record_id}/")
        request.user = user

        response = _delete_discount(request, str(record_id))

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200

        data = json.loads(response.content)
        assert data == {}

        # Verify record was deleted
        assert not HandlingFeeDiscountRecord.objects.filter(pk=record_id).exists()

    def test_delete_discount_nonexistent_record(
        self, request_factory: RequestFactory, user: User
    ) -> None:
        """Test deleting a non-existent record raises ObjectDoesNotExist."""
        request = request_factory.delete("/api/handling-fee/discount/99999/")
        request.user = user

        with pytest.raises(ObjectDoesNotExist):
            _delete_discount(request, "99999")

    def test_delete_discount_other_users_record(
        self, request_factory: RequestFactory, discount: HandlingFeeDiscountRecord
    ) -> None:
        """Test deleting another user's record raises ObjectDoesNotExist."""
        other_user = User.objects.create_user(
            oauth_org=OAuthOrganization.GOOGLE,
            oauth_id="other_oauth_id",
            email="other@example.com",
            username="otheruser",
        )

        request = request_factory.delete(f"/api/handling-fee/discount/{discount.pk}/")
        request.user = other_user

        with pytest.raises(ObjectDoesNotExist):
            _delete_discount(request, str(discount.pk))
