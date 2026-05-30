from django.urls import re_path

from main.billing import views

urlpatterns = [
    re_path(r"^subscription[/]?$", views.handle_subscription),
    re_path(r"^subscription/cancel[/]?$", views.cancel_subscription),
    re_path(r"^card-binding/init[/]?$", views.init_card_binding),
    re_path(r"^card-binding/confirm[/]?$", views.confirm_card_binding),
    re_path(r"^ecpay/return[/]?$", views.ecpay_return),
    re_path(r"^ecpay/bind-result[/]?$", views.ecpay_bind_result),
]
