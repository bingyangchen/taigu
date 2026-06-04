#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$(realpath "$0")")/../common.sh"

check_triggered_by_make
load_env_vars
check_env dev

CERT_DIR="reverse-proxy"
CERT_FILE="${CERT_DIR}/dev-cert.pem"
KEY_FILE="${CERT_DIR}/dev-key.pem"

if command -v mkcert >/dev/null 2>&1; then
  printf "${GREEN}Generating trusted dev TLS certificate with mkcert...${RESET}\n"
  if ! mkcert -install; then
    printf "${YELLOW}Could not install mkcert's local CA (sudo may be required).${RESET}\n"
    printf "${YELLOW}Run \`mkcert -install\` in your terminal, then \`make cert-dev\` again.${RESET}\n"
  fi
  mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" local.taigu.tw localhost 127.0.0.1 ::1
  printf "${GREEN} ✓ Dev certificate written to ${CERT_FILE}${RESET}\n"
  exit 0
fi

printf "${YELLOW}mkcert not found — using a self-signed certificate.${RESET}\n"
printf "${YELLOW}Service workers on https://local.taigu.tw require a system-trusted cert.${RESET}\n"
printf "${YELLOW}Install mkcert (e.g. brew install mkcert), run mkcert -install, then make cert-dev.${RESET}\n"

openssl req -x509 -newkey rsa:4096 \
  -keyout "$KEY_FILE" -out "$CERT_FILE" \
  -days 365 -nodes \
  -subj "/C=TW/ST=TW/L=TW/O=TW/OU=TW/CN=local.taigu.tw" \
  -addext "subjectAltName=DNS:local.taigu.tw,DNS:localhost,IP:127.0.0.1"
