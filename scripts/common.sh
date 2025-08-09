#!/usr/bin/env bash

WHITE='\033[0;37m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

SERVICES=(api-server frontend reverse-proxy db redis scheduler)

check_triggered_by_make() {
    if [ -z "$MAKELEVEL" ]; then
        printf "${YELLOW}This script can only be run from a Makefile.${RESET}\n"
        exit 1
    fi
}

load_env_vars() {
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    else
        printf "${YELLOW}Warning: .env file not found, using default values${RESET}\n"
    fi
}

check_env() {
    load_env_vars
    if [ "$ENV" != "$1" ]; then
        printf "${RED}This is a $1-only script, aborting...${RESET}\n"
        exit 1
    fi
}

clear_screen() {
    clear && printf "\033[3J"
}

validate_service() {
    local service=$1
    if ! echo "${SERVICES[@]}" | grep -w "$service" >/dev/null; then
        printf "${RED}Error: '$service' is not a valid service.\nMust be one of: ${SERVICES[*]}${RESET}\n"
        exit 1
    fi
}
