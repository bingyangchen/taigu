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
        set -a
        while IFS= read -r line || [ -n "$line" ]; do
            case "$line" in
                ''|\#*)
                    continue
                    ;;
                *)
                    export "$line" 2>/dev/null || true
                    ;;
            esac
        done < .env
        set +a
    else
        printf "${YELLOW}Warning: .env file not found, using default values${RESET}\n"
    fi
}

check_env() {
    load_env_vars
    if [ "$ENV" != "$1" ]; then
        printf "${RED} ✗ This is a $1-only script, aborting...${RESET}\n" >&2
        exit 1
    fi
}

clear_screen() {
    clear && printf "\033[3J"
}

clear_current_line() {
    printf "\r\033[K"
}

clear_previous_line() {
    printf "\033[1A\r\033[K"
}

validate_service() {
    local service=$1
    if ! echo "${SERVICES[@]}" | grep -w "$service" >/dev/null; then
        printf "${RED} ✗ Error: '$service' is not a valid service.\nMust be one of: ${SERVICES[*]}${RESET}\n" >&2
        exit 1
    fi
}

resolve_prod_build_image_tag() {
    local tag="${image_tag:-${IMAGE_TAG:-}}"
    if [ -z "$tag" ]; then
        tag=$(git rev-parse main 2>/dev/null || git rev-parse HEAD)
    fi
    echo "$tag"
}

resolve_prod_pull_image_tag() {
    local tag="${image_tag:-${IMAGE_TAG:-}}"
    if [ -z "$tag" ]; then
        tag=$(git rev-parse HEAD 2>/dev/null || true)
    fi
    if [ -z "$tag" ]; then
        printf "${RED} ✗ Set image_tag=<full git SHA> or IMAGE_TAG (not via .env)${RESET}\n" >&2
        exit 1
    fi
    echo "$tag"
}
