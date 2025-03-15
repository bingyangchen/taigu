#!/usr/bin/env bash

set -e
source ./scripts/common.sh

validate_service $1
load_env
clear_screen
docker compose -f compose.$ENV.yaml --progress quiet run --rm $1 bash
