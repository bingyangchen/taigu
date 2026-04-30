#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

check_triggered_by_make
load_env_vars
check_env prod

if [[ -n $(git status -s) ]]; then
    printf "${RED} ✗ Working directory has uncommitted changes.${RESET}\n" >&2
    exit 1
fi

git switch main
git pull origin main

if [[ -z "${IMAGE_TAG:-}" ]]; then
    export IMAGE_TAG="$(git rev-parse HEAD)"
fi

make pull-images-prod
make restart-and-recycle

printf "${GREEN} ✔ Deploy completed${RESET}\n"
