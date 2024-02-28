#!/usr/bin/env bash

set -e

if [ ! -e "manage.py" ]; then
    echo "Error: You should run this command under the root directory of this project."
    exit 1
fi

# Make sure that the current branch is `master`
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "master" ]; then
    echo "Error: You are not on the correct branch. Aborting."
    exit 1
fi

# Make sure that the commit message is provided
if [[ -z $1 ]]; then
    echo "Please provide the commit message."
    exit 1
fi

# Run pytest
bash ./scripts/localdev/runpytest.sh

# Update the dependency info
pipenv requirements >requirements.txt

# Commit
git add -A
git commit -m "$1"
git push

set +e
