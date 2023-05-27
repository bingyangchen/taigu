#!/bin/bash

if [[ -z $1 ]]; then
    echo Please provide the commit message.
else
    # Prepare the requirements.txt file
    pipenv requirements >requirements.txt

    # Switch to the corresponding username and email for this repo
    # git config --local user.name "Jamison Chen"
    # git config --local user.email "106208004@g.nccu.edu.tw"

    # Make git commit
    git add .
    git commit -m "$1"

    # Switch to the corresponding ssh key for this repo
    # ssh-add -D
    # ssh-add ~/.ssh/id_rsa

    # Push to GitHub
    git push origin master

    # Push and deploy on Heroku
    # git push heroku master
fi
