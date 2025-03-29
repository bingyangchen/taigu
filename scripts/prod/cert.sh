#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

check_triggered_by_make

if ! command -v certbot &>/dev/null; then
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi

sudo certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email bryan.chen.429@gmail.com \
    --domains trade-smartly.com \
    --preferred-challenges http

printf "${GREEN} ✔ SSL certificate acquired${RESET}\n"
printf "${GREEN} ✔ Auto-renewal cronjob configured${RESET}\n"
