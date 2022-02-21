def cors_exempt(func):
    def wrap(request, **args):
        res = func(request, **args)
        res["Access-Control-Allow-Credentials"] = "true"
        res["Access-Control-Allow-Methods"] = "*"
        res["Access-Control-Allow-Origin"] = request.headers.get("Origin")
        return res

    return wrap
