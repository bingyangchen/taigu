#!/usr/bin/env bash

GREEN='\033[0;32m'
RESET='\033[0m'

set -e

sudo pkill -f gunicorn
gunicorn --daemon
sudo nginx -t
sudo nginx -s reload

printf "${GREEN}Done.${RESET}\n"

set +e
