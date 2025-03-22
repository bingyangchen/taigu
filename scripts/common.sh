#!/usr/bin/env bash

WHITE='\033[0;37m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

SERVICES=(api-server frontend reverse-proxy db redis)

check_triggered_by_make() {
    if [ -z "$MAKELEVEL" ]; then
        printf "${YELLOW}This script can only be run from a Makefile.${RESET}\n"
        exit 1
    fi
}

load_env() {
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    else
        printf "${RED}Error: .env file not found${RESET}\n"
        exit 1
    fi
}

clear_screen() {
    clear && printf "\033[3J"
}

validate_service() {
    local service=$1
    if ! echo "${SERVICES[@]}" | grep -w "$service" >/dev/null; then
        printf "${RED}Error: '$service' is not a valid service. Must be one of: ${SERVICES[@]}${RESET}\n"
        exit 1
    fi
}
