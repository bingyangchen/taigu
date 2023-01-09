from django.http import JsonResponse, HttpResponse


def require_login(func):
    def wrap(request, *arg, **args):
        if request.user:
            return func(request, *arg, **args)
        else:
            return HttpResponse(
                JsonResponse({"error": "Please log in."}),
                status=401,
            )

    wrap.__name__ = func.__name__
    return wrap


# This decorator is now not used for the reason that there's a third-party
# package called django-cors-headers solving the CORS problems.
def cors_exempt(func):
    def wrap(request, **args):
        res = func(request, **args)
        res["Access-Control-Allow-Credentials"] = "true"
        res["Access-Control-Allow-Methods"] = "*"
        res["Access-Control-Allow-Origin"] = request.headers.get("Origin")
        res["Vary"] = "Origin"
        return res

    wrap.__name__ = func.__name__
    return wrap
