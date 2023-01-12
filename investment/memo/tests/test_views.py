from django.test import TestCase, Client
from django.urls import reverse

from ..views import *


class TestViews(TestCase):
    def test_read_stock_memo(self):
        client = Client()

        response = client.get(reverse(read_stock_memo))
