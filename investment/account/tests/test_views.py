from django.test import TestCase, Client
from django.urls import reverse

from ..models import User
from ..views import *


class TestViews(TestCase):
    def setUp(self):
        self.client = Client()
        self.login = reverse(login)
        self.user: User = User.objects.create_user(
            "test@test.com", "i4hfy5h9iw8r7t", username="TestUser"
        )
        login_response = self.client.post(
            self.login, {"email": "test@test.com", "password": "i4hfy5h9iw8r7t"}
        )
        login_response.set_cookie("token", login_response.headers.get("new-token"))

    def test_register(self):
        self.client = Client()
        response = self.client.post(
            reverse(register),
            {
                "username": "Temp",
                "email": "testregister@test.com",
                "password": "i4hfy5h9iw8r7t",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            User.objects.filter(email="testregister@test.com").first().email,
            "testregister@test.com",
        )
        self.assertEqual(
            User.objects.filter(email="testregister@test.com").first().username,
            "Temp",
        )

    def test_register_with_duplicate_email(self):
        self.client = Client()
        response = self.client.post(
            reverse(register),
            {
                "username": "AnotherUser",
                "email": "test@test.com",
                "password": "i4hfy5h9iw8r7t",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_login(self):
        self.client = Client()
        response = self.client.post(
            self.login, {"email": "test@test.com", "password": "i4hfy5h9iw8r7t"}
        )

        self.assertEqual(response.status_code, 200)

    # def test_login_with_wrong_password(self):
    #     response = self.client.post(
    #         self.login, {"email": "test@test.com", "password": "12345"}
    #     )

    #     self.assertEqual(response.status_code, 400)

    def test_read_me(self):
        response = self.client.get(reverse(me))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.assertEqual(response.json()["data"]["username"], "TestUser")
        self.assertEqual(response.json()["data"]["email"], "test@test.com")

    # def test_read_me_without_login(self):
    #     response = self.client.get(reverse(me))

    #     self.assertEqual(response.status_code, 401)

    def test_logout(self):
        response = self.client.get(reverse(logout))
        response.delete_cookie("token")

        self.assertEqual(response.status_code, 200)

    # def test_update_username(self):
    #     response = self.client.post(
    #         reverse(update),
    #         json.dumps({"username": "hi"}),
    #         content_type="application/json",
    #     )
    #     self.assertEqual(response.status_code, 200)

    #     self.assertEqual(response.json()["data"]["username"], "hi")

    #     response = self.client.get(reverse(me))

    #     self.assertEqual(response.json()["data"]["username"], "hi")
