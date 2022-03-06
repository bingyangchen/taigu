#! /bin/bash
# run this script after the deploying process is completed on Heroku
heroku run python manage.py migrate -a investment-backend