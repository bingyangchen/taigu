#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

check_triggered_by_make
openssl req -x509 -newkey rsa:4096 -keyout reverse-proxy/dev-key.pem -out reverse-proxy/dev-cert.pem -days 365 -nodes -subj "/C=TW/ST=TW/L=TW/O=TW/OU=TW/CN=TW/emailAddress=TW"
