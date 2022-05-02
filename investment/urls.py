from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.conf import settings

urlpatterns = [
    path(r"admin/", admin.site.urls),
    path(r"api/account/", include("investment.account.urls")),
    path(r"api/stock/", include("investment.stock.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
