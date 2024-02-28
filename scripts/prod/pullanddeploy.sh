#!/usr/bin/env bash

set -e

# Pull code
git checkout master
git pull origin master

# Install the latest dependencies if necessary
requirements="~/trade-smartly-backend/requirements.txt"
if git diff HEAD^ HEAD -- "$requirements" | grep -qE '^\+|^\-'; then
    pip install -r "$requirements"

    # If the `pip install` command above has actually caused any changes in the dependencies, all the gunicorn proccesses will get killed.
    gunicorn_process_count=$(ps aux | grep gunicorn | awk '{ print $2 }' | wc -l)
    if [ $gunicorn_process_count -eq 1 ]; then
        # Why -eq 1? This is because the command that count the process itself is a proccess that will be counted.
        gunicorn --daemon
        echo "Gunicorn restarted!"
    fi
fi

# Crontab
echo "Transforming the content of the crontab file of this project."
python ~/trade-smartly-backend/scripts/prod/transform_crontab.py
echo succeeded!

echo "Update the timezone of the system to Asia/Taipei"
sudo timedatectl set-timezone Asia/Taipei
echo succeeded!

echo "Update the real crontab."
crontab ~/trade-smartly-backend/crontab
echo succeeded!

## Undo the transform
git reset HEAD --hard
echo "The deploy process is completed!"

set +e
