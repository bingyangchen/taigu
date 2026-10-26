import pytest
from django.urls import Resolver404, resolve

from main.account import views


class TestAccountUrls:
    def test_all_url_patterns_resolve_correctly(self) -> None:
        """Test that all URL patterns resolve to the correct view functions."""
        url_patterns = [
            ("/api/account/csrf-token/", views.csrf_token),
            ("/api/account/csrf-token", views.csrf_token),
            ("/api/account/authorization-url/", views.get_authorization_url),
            ("/api/account/authorization-url", views.get_authorization_url),
            ("/api/account/google-login/", views.google_login),
            ("/api/account/google-login", views.google_login),
            ("/api/account/refresh-token/", views.refresh_token),
            ("/api/account/refresh-token", views.refresh_token),
            ("/api/account/logout/", views.logout),
            ("/api/account/logout", views.logout),
            ("/api/account/me/", views.me),
            ("/api/account/me", views.me),
            ("/api/account/open-session/", views.open_session),
            ("/api/account/open-session", views.open_session),
            ("/api/account/update/", views.update),
            ("/api/account/update", views.update),
            ("/api/account/change-binding/", views.change_google_binding),
            ("/api/account/change-binding", views.change_google_binding),
        ]

        for url, expected_view in url_patterns:
            resolver = resolve(url)
            assert resolver.func == expected_view

    def test_url_patterns_configuration(self) -> None:
        """Test that URL patterns are configured correctly with expected count and no duplicates."""
        from main.account.urls import urlpatterns

        assert len(urlpatterns) == 9

        # Check for duplicate patterns
        patterns = []
        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                patterns.append(pattern.pattern._regex)

        assert len(patterns) == len(set(patterns))

    def test_url_patterns_regex_format(self) -> None:
        """Test that URL patterns use the expected regex format."""
        from main.account.urls import urlpatterns

        expected_patterns = [
            r"^csrf-token[/]?$",
            r"^authorization-url[/]?$",
            r"^google-login[/]?$",
            r"^refresh-token[/]?$",
            r"^logout[/]?$",
            r"^me[/]?$",
            r"^open-session[/]?$",
            r"^update[/]?$",
            r"^change-binding[/]?$",
        ]

        actual_patterns = []
        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                actual_patterns.append(pattern.pattern._regex)

        # Sort both lists for comparison
        expected_patterns.sort()
        actual_patterns.sort()

        assert actual_patterns == expected_patterns

    def test_url_patterns_case_sensitivity(self) -> None:
        """Test that URLs are case sensitive as expected."""
        url = "/api/account/google-login/"

        # Should not match with different case
        with pytest.raises(Resolver404):
            resolve(url.upper())
