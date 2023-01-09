import json

from django.http import JsonResponse, HttpRequest, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password

from rest_framework.authtoken.models import Token

from .models import User
from .utils import validate_registration_info, update_user
from ..decorators import require_login


@csrf_exempt
@require_POST
def register(request):
    res = {"success": False}
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
        return HttpResponseBadRequest(JsonResponse(res))


@csrf_exempt
@require_POST
def login(request):
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
            return HttpResponseBadRequest(JsonResponse(res))
    else:
        res["error"] = "Info not sufficient."
        return HttpResponseBadRequest(JsonResponse(res))


@csrf_exempt
@require_POST
@require_login
def check_login(request):
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
@require_login
def logout(request):
    res = {"success": False}
    Token.objects.filter(user=request.user).delete()
    res["success"] = True
    res = JsonResponse(res)
    res.headers["is-log-out"] = "yes"
    res.delete_cookie("token", samesite="None")
    return res


@csrf_exempt
@require_POST
@require_login
def update(request: HttpRequest):
    res = {"success": False, "error": None, "data": {}}
    try:
        data_posted = json.loads(request.body)

        id = data_posted.get("id")
        username = data_posted.get("username")
        email = data_posted.get("email")
        avatar_url = data_posted.get("avatar_url")
        old_password = data_posted.get("old_password")
        new_password = data_posted.get("new_password")

        u = update_user(
            id=id,
            username=username,
            email=email,
            avatar_url=avatar_url,
            old_password=old_password,
            new_password=new_password,
        )

        res["success"] = True
        res["data"] = {
            "id": u.pk,
            "username": u.username,
            "email": u.email,
            "avatar_url": u.avatar_url or None,
        }
        return JsonResponse(res)
    except Exception as e:
        try:
            res["error"] = str(list(e)[0])
        except:
            res["error"] = str(e)
        return HttpResponseBadRequest(JsonResponse(res))


@csrf_exempt
@require_POST
@require_login
def delete(request: HttpRequest):
    data_posted = json.loads(request.body)
    password = data_posted.get("password")

    res = {"success": False}

    if check_password(password, request.user.password):
        Token.objects.filter(user=request.user).delete()
        request.user.delete()
        res["success"] = True
        res = JsonResponse(res)
        res.headers["is-log-out"] = "yes"
        res.delete_cookie("token", samesite="None")
        return res
    else:
        res["error"] = "Wrong Password"
        return HttpResponseBadRequest(JsonResponse(res))
