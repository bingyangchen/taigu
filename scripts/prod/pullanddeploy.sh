#!/usr/bin/env bash

# Define color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

set -e

if [ ! -e "manage.py" ]; then
    echo "Error: You should run this command under the root directory of this project."
    exit 1
fi

# Pull code
git checkout master
git pull origin master

# Install the latest dependencies if necessary
requirements="./requirements.txt"
if git diff HEAD^ HEAD -- "$requirements" | grep -qE '^\+|^\-'; then
    pip install -r "$requirements"

    # If the `pip install` command above has actually caused any changes in the dependencies, all the gunicorn proccesses will get killed.
    gunicorn_process_count=$(ps aux | grep gunicorn | awk '{ print $2 }' | wc -l)
    if [ $gunicorn_process_count -eq 1 ]; then
        # Why -eq 1? This is because the command that count the process itself is a proccess that will be counted.
        gunicorn --daemon
        echo -e "${GREEN}Gunicorn restarted!${RESET}"
    fi
fi

# Crontab
echo "Transforming the content of the crontab file of this project..."
python ~/trade-smartly-backend/scripts/prod/transform_crontab.py
echo -e "${GREEN}succeeded!${RESET}"

echo "Updating the timezone of the system to Asia/Taipei..."
sudo timedatectl set-timezone Asia/Taipei
echo -e "${GREEN}succeeded!${RESET}"

echo "Restarting cron service..."
sudo systemctl restart cron
echo -e "${GREEN}succeeded!${RESET}"

echo "Updating the real crontab..."
crontab ~/trade-smartly-backend/crontab
echo -e "${GREEN}succeeded!${RESET}"

## Undo the transform
git reset HEAD --hard

echo -e "${YELLOW}THE DEPLOY PROCESS IS COMPLETED!${RESET}"

set +e
