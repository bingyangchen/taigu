import os

is_dev = os.environ.get("ENV") == "dev"

wsgi_app = "main.wsgi"
workers = 3 if is_dev else (os.cpu_count() or 1) * 2 + 1
bind = "0.0.0.0:8000"
reload = is_dev
reload_extra_files = []
