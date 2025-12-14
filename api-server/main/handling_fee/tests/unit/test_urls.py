import pytest
from django.urls import Resolver404, resolve

from main.handling_fee import views


class TestHandlingFeeUrls:
    def test_all_url_patterns_resolve_correctly(self) -> None:
        """Test that all URL patterns resolve to the correct view functions."""
        url_patterns = [
            ("/api/handling-fee/discount/", views.create_or_list_discount),
            ("/api/handling-fee/discount", views.create_or_list_discount),
            ("/api/handling-fee/discount/123/", views.update_or_delete_discount),
            ("/api/handling-fee/discount/123", views.update_or_delete_discount),
        ]

        for url, expected_view in url_patterns:
            resolver = resolve(url)
            assert resolver.func == expected_view

    def test_url_patterns_configuration(self) -> None:
        """Test that URL patterns are configured correctly with expected count and no duplicates."""
        from main.handling_fee.urls import urlpatterns

        # Should have exactly 2 active patterns
        assert len(urlpatterns) == 2

        # Check for duplicate patterns
        patterns = []
        for pattern in urlpatterns:
            if hasattr(pattern, "pattern") and hasattr(pattern.pattern, "_regex"):
                patterns.append(pattern.pattern._regex)

        assert len(patterns) == len(set(patterns))

    def test_url_patterns_regex_format(self) -> None:
        """Test that URL patterns use the expected regex format."""
        from main.handling_fee.urls import urlpatterns

        expected_patterns = [
            r"^discount[/]?$",
            r"^discount/(?P<id>\w+)[/]?$",
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
        url = "/api/handling-fee/discount/"

        # Should not match with different case
        with pytest.raises(Resolver404):
            resolve(url.upper())

    def test_invalid_urls_raise_resolver404(self) -> None:
        """Test that invalid URLs properly raise Resolver404."""
        # Test non-existent URL
        with pytest.raises(Resolver404):
            resolve("/api/handling-fee/non-existent-url/")

        # Test invalid discount URL (missing id)
        with pytest.raises(Resolver404):
            resolve("/api/handling-fee/discount//")

    def test_regex_patterns_specificity(self) -> None:
        """Test that similar URLs don't conflict."""
        # These should resolve to different views
        discount_list = resolve("/api/handling-fee/discount/")
        discount_update = resolve("/api/handling-fee/discount/123/")

        assert discount_list.func == views.create_or_list_discount
        assert discount_update.func == views.update_or_delete_discount
