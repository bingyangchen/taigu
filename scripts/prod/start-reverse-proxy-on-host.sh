#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

check_triggered_by_make

sudo cp reverse-proxy/nginx.conf /etc/nginx/sites-available/trade-smartly
sudo ln -sf /etc/nginx/sites-available/trade-smartly /etc/nginx/sites-enabled/trade-smartly
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t

if ! systemctl is-active --quiet nginx; then
    printf "${GREEN}Starting nginx...${RESET}\n"
    sudo systemctl start nginx
else
    printf "${GREEN}Reloading nginx configuration...${RESET}\n"
    sudo nginx -s reload
fi
