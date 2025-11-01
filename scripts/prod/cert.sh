





# THIS SCRIPT IS DEPRECATED. NOW WE USE CLOUDFLARE TO GENERATE THE SSL CERTIFICATE.






#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

check_triggered_by_make
check_env prod

if ! command -v certbot &>/dev/null; then
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi

sudo certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email bryan.chen.429@gmail.com \
    --domains taigu.tw \
    --preferred-challenges http

printf "${GREEN} ✔ SSL certificate acquired${RESET}\n"
printf "${GREEN} ✔ Auto-renewal cronjob configured${RESET}\n"
