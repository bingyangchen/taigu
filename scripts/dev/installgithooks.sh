#!/usr/bin/env bash

set -e
source "$(dirname "$(realpath "$0")")/../common.sh"

printf "${BLUE}Installing git hooks... ${RESET}"

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cp -R "$SCRIPT_DIR"/git-hooks/* .git/hooks/
chmod +x .git/hooks/*

printf "${GREEN}DONE!${RESET}\n"
