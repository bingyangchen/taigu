#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

# NOTE: Do not call check_triggered_by_make because this script is also called by
#       post-merge hook.

printf "${BLUE}Installing git hooks... ${RESET}"

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cp -R "$SCRIPT_DIR"/git-hooks/* .git/hooks/
chmod +x .git/hooks/*

printf "${GREEN}DONE${RESET}\n"
