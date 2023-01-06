from django.contrib import admin
from django.urls import re_path, include
from django.conf.urls.static import static
from django.conf import settings

urlpatterns = [
    re_path(r"^admin/", admin.site.urls),
    re_path(r"^api/account/", include("investment.account.urls")),
    re_path(r"^api/stock/", include("investment.stock.urls")),
    re_path(r"^api/memo/", include("investment.memo.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
