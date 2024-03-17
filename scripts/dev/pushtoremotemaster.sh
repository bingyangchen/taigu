#!/usr/bin/env bash

set -e

# Define color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

if [ ! -e "manage.py" ]; then
    printf "${RED}You should run this command under the root directory of this project. Aborting.${RESET}\n"
    exit 1
fi

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "master" ]; then
    printf "${RED}You're not on the correct branch. Aborting.${RESET}\n"
    exit 1
fi

if [[ -n $(git status -s) ]]; then
    printf "${YELLOW}Working directory has uncommitted changes. Aborting.${RESET}\n"
    exit 1
fi

# Update the dependency info
pipenv requirements >requirements.txt

# Commit requirements.txt if needed
if [[ -n $(git status -s) ]]; then
    git add -A
    git commit -m "update requirements.txt"
fi

git push origin "$current_branch" # tests will be run via the pre-push hook

printf "${GREEN}SUCCESS!${RESET}\n"

set +e
