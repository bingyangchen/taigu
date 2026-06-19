import json

from django.http import HttpResponseNotAllowed, JsonResponse
from django.test import RequestFactory
from django.urls import resolve

from main.core import views


class TestHealthView:
    def test_health_returns_ok(self) -> None:
        request = RequestFactory().get("/api/health/")

        response = views.health(request)

        assert isinstance(response, JsonResponse)
        assert response.status_code == 200
        assert json.loads(response.content) == {"status": "ok"}

    def test_health_rejects_non_get(self) -> None:
        request = RequestFactory().post("/api/health/")

        response = views.health(request)

        assert isinstance(response, HttpResponseNotAllowed)
        assert response.status_code == 405


class TestHealthUrl:
    def test_health_url_resolves(self) -> None:
        assert resolve("/api/health/").func == views.health
        assert resolve("/api/health").func == views.health
