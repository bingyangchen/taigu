#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

# NOTE: Do not call check_triggered_by_make because this script is also called by
#       post-merge hook.

check_env dev
echo "Installing git hooks..."

find .git/hooks -type f ! -name '*.sample' -delete
SCRIPT_DIR=$(dirname "$(realpath "$0")")
cp -R "$SCRIPT_DIR"/git-hooks/* .git/hooks/
chmod +x .git/hooks/*

clear_previous_line
printf "${GREEN}Installing git hooks... ✔${RESET}\n"
