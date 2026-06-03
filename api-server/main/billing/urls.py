from django.urls import re_path

from main.billing import views

urlpatterns = [
    re_path(r"^subscription[/]?$", views.handle_subscription),
    re_path(r"^subscription/cancel[/]?$", views.cancel_subscription),
    re_path(r"^ecpay/return[/]?$", views.ecpay_return),
    re_path(r"^ecpay/order-result[/]?$", views.ecpay_order_result),
    re_path(r"^ecpay/period-return[/]?$", views.ecpay_period_return),
]
