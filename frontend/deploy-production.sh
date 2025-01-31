#!/usr/bin/env bash

# This script is used to deploy the built code to the production environment.
# Do not run this script at local.

set -e

git fetch origin build
git branch -D previous_build
git branch -m build previous_build
git checkout -b build FETCH_HEAD
printf "\033[0;32mCopying built code to production server...\033[0m\n"
sudo rsync -a --delete-excluded --exclude='.git' ~/trade-smartly-frontend/ /var/www/html/trade-smartly-frontend/
printf "\033[0;33mSuccess!\033[0m\n"
