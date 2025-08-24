SHELL := /usr/bin/env bash
.SILENT:

.PHONY: build-dev
build-dev:
	$(SHELL) ./scripts/build.sh dev

.PHONY: build-prod
build-prod:
	$(SHELL) ./scripts/build.sh prod

.PHONY: start
start:
	$(SHELL) ./scripts/start.sh

.PHONY: stop
stop:
	$(SHELL) ./scripts/stop.sh

.PHONY: restart
restart:
	$(SHELL) ./scripts/restart.sh

.PHONY: restart-and-recycle
restart-and-recycle:
	$(SHELL) ./scripts/restart.sh --recycle

.PHONY: shell-api-server
shell-api-server:
	$(SHELL) ./scripts/enter-shell.sh api-server

.PHONY: shell-frontend
shell-frontend:
	$(SHELL) ./scripts/enter-shell.sh frontend

.PHONY: shell-reverse-proxy
shell-reverse-proxy:
	$(SHELL) ./scripts/enter-shell.sh reverse-proxy

.PHONY: shell-db
shell-db:
	$(SHELL) ./scripts/enter-shell.sh db

.PHONY: shell-redis
shell-redis:
	$(SHELL) ./scripts/enter-shell.sh redis

.PHONY: shell-scheduler
shell-scheduler:
	$(SHELL) ./scripts/enter-shell.sh scheduler

.PHONY: ipython
ipython:
	$(SHELL) ./scripts/ipython.sh

.PHONY: test
test:
	$(SHELL) ./scripts/dev/test.sh

.PHONY: install-git-hooks
install-git-hooks:
	$(SHELL) ./scripts/dev/install-git-hooks.sh

.PHONY: cert-dev
cert-dev:
	$(SHELL) ./scripts/dev/cert.sh

.PHONY: cert-prod
cert-prod:
	$(SHELL) ./scripts/prod/cert.sh

.PHONY: push-images-dev
push-images-dev:
	$(SHELL) ./scripts/dev/push-images.sh dev

.PHONY: push-images-prod
push-images-prod:
	$(SHELL) ./scripts/dev/push-images.sh prod

.PHONY: pull-images-dev
pull-images-dev:
	$(SHELL) ./scripts/prod/pull-images.sh dev

.PHONY: pull-images-prod
pull-images-prod:
	$(SHELL) ./scripts/prod/pull-images.sh prod

.PHONY: deploy
deploy:
	$(SHELL) ./scripts/prod/deploy.sh
