from django.http import JsonResponse, HttpResponseNotFound


def require_login(func):
    def wrap(request, *arg, **args):
        try:
            if request.user:
                return func(request, *arg, **args)
            else:
                res = {
                    "error-message": "Please log in.",
                    "is-login": False,
                    "status": "failed",
                }
                return JsonResponse(res)
        except Exception as e:
            return HttpResponseNotFound(str(e))

    wrap.__name__ = func.__name__
    return wrap


def cors_exempt(func):
    def wrap(request, **args):
        res = func(request, **args)
        res["Access-Control-Allow-Credentials"] = "true"
        res["Access-Control-Allow-Methods"] = "*"
        res["Access-Control-Allow-Origin"] = request.headers.get("Origin")
        return res

    wrap.__name__ = func.__name__
    return wrap
