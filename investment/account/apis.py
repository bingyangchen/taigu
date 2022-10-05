from django.http import JsonResponse, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.contrib.auth import authenticate
from django.conf import settings

from rest_framework.authtoken.models import Token

from .models import user as User
from .utils import validate_registration_info, update_user
from ..decorators import require_login


@csrf_exempt
@require_POST
def register(request):
    """
    "username": str,
    "email": str,
    "password": str
    """
    res = {"success": False, "error": None}
    try:
        username = request.POST.get("username")
        email = request.POST.get("email")
        password = request.POST.get("password")

        validate_registration_info(username, email, password)

        User.objects.create_user(email, password, username=username)

        res["success"] = True
        return JsonResponse(res)
    except Exception as e:
        try:
            res["error"] = str(list(e)[0])
        except:
            res["error"] = str(e)
        return HttpResponseNotFound(JsonResponse(res))


@csrf_exempt
@require_POST
def login(request):
    """
    "email": str,
    "password": str
    """
    res = {"success": False, "error": None}
    if (email := request.POST.get("email")) and (
        password := request.POST.get("password")
    ):
        try:
            user = authenticate(request, email=email, password=password)
            request.user = user
            token = Token.objects.get_or_create(user=user)[0].key
            res["success"] = True
            res = JsonResponse(res)
            res.headers["new-token"] = token
            return res
        except Exception as e:
            res["error"] = str(e)
            return HttpResponseNotFound(JsonResponse(res))
    else:
        res["error"] = "Info not sufficient."
        return HttpResponseNotFound(JsonResponse(res))


@csrf_exempt
@require_POST
@require_login
def check_login(request):
    """ """
    res = {
        "error": None,
        "success": True,
        "data": {
            "id": request.user.pk,
            "username": request.user.username,
            "email": request.user.email,
            "avatar_url": request.user.avatar_url or None,
        },
    }
    return JsonResponse(res)


@csrf_exempt
@require_POST
def logout(request):
    """ """
    res = {"success": False}
    Token.objects.filter(user=request.user).delete()
    res["success"] = True
    res = JsonResponse(res)
    res.headers["is-log-out"] = "yes"
    res.delete_cookie("token", samesite=settings.CSRF_COOKIE_SAMESITE)
    return res


@csrf_exempt
@require_POST
def update(request):
    """
    "id": str,
    "username": str | None,
    "email": str | None,
    "avatar_url": str | None
    "old_password": str | None
    "new_password": str | None
    """
    res = {"success": False, "error": None}
    try:
        id = request.POST.get("id")
        username = request.POST.get("username")
        email = request.POST.get("email")
        avatar_url = request.POST.get("avatar_url")
        old_password = request.POST.get("old_password")
        new_password = request.POST.get("new_password")

        update_user(
            id=id,
            username=username,
            email=email,
            avatar_url=avatar_url,
            old_password=old_password,
            new_password=new_password,
        )

        res["success"] = True
        return JsonResponse(res)
    except Exception as e:
        try:
            res["error"] = str(list(e)[0])
        except:
            res["error"] = str(e)
        return HttpResponseNotFound(JsonResponse(res))
