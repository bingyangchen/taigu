from django.http import JsonResponse, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.contrib.auth import authenticate
from django.conf import settings

from rest_framework.authtoken.models import Token

from .models import user as User
from .utils import validate_registration_info, validate_update_info
from ..decorators import require_login


@csrf_exempt
@require_POST
def register(request):
    """
    "username": string,
    "email": string,
    "password": string
    """
    res = {"status": "failed", "error-message": ""}
    try:
        validate_registration_info(request)
        username = request.POST.get("username")
        email = request.POST.get("email")
        password = request.POST.get("password")

        User.objects.create_user(email, password, username=username)

        res["status"] = "succeeded"
        return JsonResponse(res)
    except Exception as e:
        try:
            res["error-message"] = str(list(e)[0])
        except:
            res["error-message"] = str(e)
        return HttpResponseNotFound(JsonResponse(res))
    """
    "status": "succeeded" | "failed",
    "error-message": string,
    """


@csrf_exempt
@require_POST
def login(request):
    """
    "email": string,
    "password": string
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
            "avatar_url": (settings.MEDIA_URL + str(request.user.avatar))
            if request.user.avatar
            else None,
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
    "id": string,
    "username": string | None,
    "email": string | None,
    "password": string | None
    """
    res = {"status": "failed", "error-message": ""}
    try:
        id = request.POST.get("id")
        username = request.POST.get("username")
        email = request.POST.get("email")
        password = request.POST.get("password")
        validate_update_info(id=id, username=username, email=email, password=password)

        request.user.username = username if username else request.user.username
        request.user.email = email if email else request.user.email
        request.user.password = password if password else request.user.password
        request.user.save()

        res["status"] = "succeeded"
        return JsonResponse(res)
    except Exception as e:
        try:
            res["error-message"] = str(list(e)[0])
        except:
            res["error-message"] = str(e)
        return HttpResponseNotFound(JsonResponse(res))
    """
    "status": "succeeded" | "failed",
    "error-message": string,
    """
