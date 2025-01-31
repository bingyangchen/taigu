wsgi_app = "main.wsgi"
workers = 3
bind = "127.0.0.1:8000"
reload = True
reload_extra_files = [".env"]
