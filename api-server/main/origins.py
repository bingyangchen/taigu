from urllib.parse import urlparse

from main.env import Env, env

_ORIGINS: dict[Env, dict[str, str]] = {
    Env.PROD: {
        "frontend": "https://taigu.tw",
        "api": "https://api.taigu.tw",
    },
    Env.DEV: {
        "frontend": "https://local.taigu.tw",
        "api": "https://local.taigu.tw",
    },
}


def get_public_frontend_origin() -> str:
    return _ORIGINS[env.ENV]["frontend"]


def get_public_api_origin() -> str:
    return _ORIGINS[env.ENV]["api"]


def get_public_frontend_host() -> str:
    return urlparse(get_public_frontend_origin()).netloc


def get_public_api_host() -> str:
    return urlparse(get_public_api_origin()).netloc


def get_csrf_cookie_domain() -> str | None:
    if env.ENV == Env.PROD:
        return f".{get_public_frontend_host()}"
    return None


def build_frontend_urls(*paths: str) -> list[str]:
    return [
        f"{config['frontend']}{path}" for config in _ORIGINS.values() for path in paths
    ]
