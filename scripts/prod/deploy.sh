#!/usr/bin/env bash

set -euo pipefail
source "$(dirname "$(realpath "$0")")/../common.sh"

require_triggered_by_make
load_env_vars
check_env prod

require_clean_working_tree

git switch main
git pull origin main

export IMAGE_TAG="$(resolve_prod_image_tag)"

make pull-images-prod
make migrate-prod
make restart-and-recycle

printf "${GREEN} ✔ Deploy completed${RESET}\n"
