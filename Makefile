SHELL := /usr/bin/env bash

# build-dev | build-prod
.PHONY: build-%
build-%:
	$(SHELL) ./scripts/build.sh $*

.PHONY: start
start:
	$(SHELL) ./scripts/start.sh

.PHONY: stop
stop:
	$(SHELL) ./scripts/stop.sh

.PHONY: restart
restart:
	$(SHELL) ./scripts/restart.sh

# shell-api-server | shell-frontend | shell-reverse-proxy | shell-db | shell-redis | shell-scheduler
.PHONY: shell-%
shell-%:
	$(SHELL) ./scripts/enter-shell.sh $*

.PHONY: ipython
ipython:
	$(SHELL) ./scripts/ipython.sh

.PHONY: test
test:
	$(SHELL) ./scripts/dev/run-pytest.sh

.PHONY: install-git-hooks
install-git-hooks:
	$(SHELL) ./scripts/dev/install-git-hooks.sh

# cert-dev | cert-prod
.PHONY: cert-%
cert-%:
	$(SHELL) ./scripts/$*/cert.sh

# push-images-dev | push-images-prod
.PHONY: push-images-%
push-images-%:
	$(SHELL) ./scripts/dev/push-images.sh $*

# pull-images-dev | pull-images-prod
.PHONY: pull-images-%
pull-images-%:
	$(SHELL) ./scripts/prod/pull-images.sh $*

.PHONY: deploy
deploy:
	$(SHELL) ./scripts/prod/deploy.sh
