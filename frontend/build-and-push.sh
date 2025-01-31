#!/usr/bin/env bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

print_centered_message() {
    local message="$1"
    local color="${2:-$BLUE}"
    local width=$(tput cols)
    local message_length=${#message}
    local padding=$(((width - message_length - 2) / 2))

    printf "${color}%*s${RESET}" $padding | tr ' ' '='
    printf " ${color}%s${RESET} " "$message"
    printf "${color}%*s${RESET}\n" $padding | tr ' ' '='
}

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "master" ]; then
    printf "${RED}Error: You are not on the correct branch. Aborting.${RESET}\n"
    exit 1
fi

if [[ -n $(git status -s) ]]; then
    printf "${RED}Working directory has uncommitted changes.${RESET}\n"
    exit 1
fi

# Delete `build` branch if it exists
if git show-ref --verify --quiet refs/heads/build; then
    git branch -D build
fi

git switch -c build

npm run build
print_centered_message "Assets Built" "${BLUE}"

git rm -rf .

cat >.gitignore <<EOL
node_modules/
.gitignore
.DS_Store
dev-cert.pem
dev-key.pem
EOL

mv build/* .
rm -rf build
rm -rf src
git add -A
git commit -m "build"
git push -f origin build
git switch "$current_branch"
git branch -D build
print_centered_message "Done!" "${GREEN}"
