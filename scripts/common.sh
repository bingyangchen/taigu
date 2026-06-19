#!/usr/bin/env bash

WHITE='\033[0;37m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

SERVICES=(api-server frontend reverse-proxy db redis scheduler)
DEPLOYMENT_ENVIRONMENTS=(dev prod)

require_triggered_by_make() {
    if [ -z "${MAKELEVEL:-}" ]; then
        printf "${YELLOW}This script can only be run from a Makefile.${RESET}\n"
        exit 1
    fi
}

load_env_vars() {
    if [ -f .env ]; then
        local line
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
    local environment="${ENV:-}"
    local expected_environment="${1:-}"
    if [ "$environment" != "$expected_environment" ]; then
        printf "${RED} ✗ This is a $expected_environment-only script, aborting...${RESET}\n" >&2
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
    local service="${1:-}"
    if ! echo "${SERVICES[@]}" | grep -w "$service" >/dev/null; then
        printf "${RED} ✗ Error: '$service' is not a valid service.\nMust be one of: ${SERVICES[*]}${RESET}\n" >&2
        exit 1
    fi
}

validate_environment() {
    local environment="${1:-}"
    local valid_environment
    local usage="${DEPLOYMENT_ENVIRONMENTS[*]}"
    for valid_environment in "${DEPLOYMENT_ENVIRONMENTS[@]}"; do
        if [ "$environment" == "$valid_environment" ]; then
            return
        fi
    done

    printf "${RED} ✗ Usage: $0 <${usage// /|}>${RESET}\n" >&2
    exit 1
}

require_clean_working_tree() {
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        printf "${RED} ✗ Working directory has uncommitted changes. Commit or stash them first so the image tag matches its contents.${RESET}\n" >&2
        exit 1
    fi
}

require_head_is_main() {
    local main_sha
    main_sha="$(git rev-parse main 2>/dev/null || true)"
    if [ -z "$main_sha" ]; then
        printf "${RED} ✗ Cannot resolve the 'main' branch.${RESET}\n" >&2
        exit 1
    fi
    if [ "$(git rev-parse HEAD)" != "$main_sha" ]; then
        printf "${RED} ✗ Production images must be built from 'main'. Run 'git switch main' first.${RESET}\n" >&2
        exit 1
    fi
}

resolve_prod_image_tag() {
    local tag="${IMAGE_TAG:-}"
    if [ -z "$tag" ]; then
        tag=$(git rev-parse main 2>/dev/null || true)
    fi
    if [ -z "$tag" ]; then
        printf "${RED} ✗ Set IMAGE_TAG=<full git SHA> (not via .env)${RESET}\n" >&2
        exit 1
    fi
    echo "$tag"
}
