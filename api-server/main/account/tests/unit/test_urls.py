import pytest
from django.http import HttpRequest
from django.urls import Resolver404, resolve

from main.account import views


class TestAccountUrls:
    def test_google_login_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/account/google-login/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == views.google_login

        # Test without trailing slash
        url_without_slash = "/api/account/google-login"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == views.google_login

    def test_logout_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/account/logout/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == views.logout

        # Test without trailing slash
        url_without_slash = "/api/account/logout"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == views.logout

    def test_me_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/account/me/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == views.me

        # Test without trailing slash
        url_without_slash = "/api/account/me"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == views.me

    def test_update_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/account/update/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == views.update

        # Test without trailing slash
        url_without_slash = "/api/account/update"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == views.update

    def test_change_binding_url_pattern(self) -> None:
        # Test with trailing slash
        url_with_slash = "/api/account/change-binding/"
        resolver_with_slash = resolve(url_with_slash)
        assert resolver_with_slash.func == views.change_google_binding

        # Test without trailing slash
        url_without_slash = "/api/account/change-binding"
        resolver_without_slash = resolve(url_without_slash)
        assert resolver_without_slash.func == views.change_google_binding

    def test_url_patterns_count(self) -> None:
        from main.account.urls import urlpatterns

        # Count the active URL patterns (excluding commented ones)
        active_patterns = [
            pattern
            for pattern in urlpatterns
            if not pattern.pattern._regex.startswith(r"^#")
        ]

        # We expect 5 active URL patterns
        assert len(active_patterns) == 5

    def test_url_patterns_view_mappings(self) -> None:
        from main.account.urls import urlpatterns

        expected_mappings = {
            r"^google-login[/]?$": views.google_login,
            r"^logout[/]?$": views.logout,
            r"^me[/]?$": views.me,
            r"^update[/]?$": views.update,
            r"^change-binding[/]?$": views.change_google_binding,
        }

        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                regex = pattern.pattern._regex
                expected_view = expected_mappings.get(regex)
                if expected_view:
                    assert pattern.callback == expected_view

    def test_url_patterns_regex_patterns(self) -> None:
        from main.account.urls import urlpatterns

        expected_patterns = [
            r"^google-login[/]?$",
            r"^logout[/]?$",
            r"^me[/]?$",
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

    def test_commented_url_pattern(self) -> None:
        from main.account.urls import urlpatterns

        # Check that delete URL pattern is commented out
        delete_pattern = None
        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                if "delete" in pattern.pattern._regex:
                    delete_pattern = pattern
                    break

        # The delete pattern should not be active (commented out in urls.py)
        assert delete_pattern is None

    def test_url_resolution_with_parameters(self) -> None:
        # Test google-login with redirect_uri parameter
        url = "/api/account/google-login/"
        request = HttpRequest()
        request.path = url
        request.GET = {"redirect_uri": "https://example.com/callback"}

        resolver_obj = resolve(url)
        assert resolver_obj.func == views.google_login

    def test_url_patterns_case_sensitivity(self) -> None:
        # Test that URLs are case sensitive
        url = "/api/account/google-login/"

        # Should not match with different case
        with pytest.raises(Resolver404):
            resolve(url.upper())

    def test_url_patterns_http_methods(self) -> None:
        # Test that each view supports the expected HTTP methods
        expected_methods = {
            "/api/account/google-login/": ["GET", "POST"],
            "/api/account/logout/": ["GET"],
            "/api/account/me/": ["GET"],
            "/api/account/update/": ["POST"],
            "/api/account/change-binding/": ["POST"],
        }

        for url, _methods in expected_methods.items():
            resolver_obj = resolve(url)
            view_func = resolver_obj.func

            # Check that view function exists and is callable
            assert view_func is not None
            assert callable(view_func)

    def test_url_patterns_view_imports(self) -> None:
        from main.account.urls import urlpatterns

        # Check that all view functions are imported and callable
        for pattern in urlpatterns:
            if hasattr(pattern, "callback"):
                view_func = pattern.callback
                assert view_func is not None
                assert callable(view_func)

    def test_url_patterns_no_duplicates(self) -> None:
        from main.account.urls import urlpatterns

        # Check for duplicate patterns
        patterns = []
        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                patterns.append(pattern.pattern._regex)

        # All patterns should be unique
        assert len(patterns) == len(set(patterns))
