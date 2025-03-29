#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

check_triggered_by_make

if [[ -n $(git status -s) ]]; then
    printf "${RED}Working directory has uncommitted changes.${RESET}\n"
    exit 1
fi

git switch main
git pull origin main
make build
make restart

printf "${GREEN} ✔ Build and restart completed${RESET}\n"
