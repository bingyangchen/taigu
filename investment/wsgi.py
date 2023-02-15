import os

from django.core.wsgi import get_wsgi_application
from dj_static import Cling  # for Heroku

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "investment.production_settings")

# application = get_wsgi_application()
application = Cling(get_wsgi_application())  # for Heroku
