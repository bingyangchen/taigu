from django.test import TestCase
import datetime
import time
import pytz

# Run the following command:
# `python manage.py test investment.stock.tests`

# print(type(datetime.datetime.strptime("2022-04-29", "%Y-%m-%d").date()))
# print(time.strptime("2022-04-29", "%Y-%m-%d"))
# print("".split(","))
t = (datetime.datetime.now(pytz.utc) + datetime.timedelta(hours=8)).date()
print(t, type(t))
t -= datetime.timedelta(days=1)
print(t, type(t))
