import pytest
from django.db.utils import IntegrityError

from main.account.models import User


@pytest.mark.django_db
def test_user_class_1() -> None:
    u = User.objects.create()
    assert (
        u.oauth_org == ""
        and u.oauth_id == ""
        and u.username == ""
        and u.email == ""
        and u.avatar_url is None
    )

    with pytest.raises(IntegrityError):
        User.objects.create()
