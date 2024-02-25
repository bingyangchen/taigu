import dotenv
from django.core.wsgi import get_wsgi_application

dotenv.load_dotenv()
application = get_wsgi_application()
