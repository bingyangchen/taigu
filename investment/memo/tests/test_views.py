from django.test import TestCase, Client
from django.urls import reverse

from ..views import *
from investment.account.models import *
from investment.account.views import *


class TestViews(TestCase):
    def test_read_stock_memo(self):
        client = Client()

        user = User.objects.create_user("test@test.com", "i4hfy5h9iw8r7t")
        print(
            client.post(
                reverse(login), {"email": "test@test.com", "password": "i4hfy5h9iw8r7t"}
            )
        )
        # client.login(email="test@test.com", password="i4hfy5h9iw8r7t")
        # response = client.get(reverse(read_stock_memo))

        # self.assertEquals(response.status_code, 200)
