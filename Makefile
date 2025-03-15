.PHONY: build
build:
	$(SHELL) ./scripts/build.sh

.PHONY: start
start:
	$(SHELL) ./scripts/start.sh

.PHONY: stop
stop:
	$(SHELL) ./scripts/stop.sh

.PHONY: restart
restart:
	$(SHELL) ./scripts/restart.sh

# api-server-shell | frontend-shell | reverse-proxy-shell | db-shell | redis-shell
.PHONY: %-shell
%-shell:
	$(SHELL) ./scripts/enter-shell.sh $*

# Install/update all git hooks (for development, run this only once when you clone this repo)
.PHONY: install-git-hooks
install-git-hooks:
	$(SHELL) ./scripts/dev/installgithooks.sh

# Push code to remote master branch (for development)
.PHONY: push-to-remote-master
push-to-remote-master:
	$(SHELL) ./scripts/dev/pushtoremotemaster.sh

# Run pytest (for development)
.PHONY: run-pytest
run-pytest:
	$(SHELL) ./scripts/dev/runpytest.sh

# Pull code from remote master branch and deploy (for production)
.PHONY: pull-master-and-deploy
pull-master-and-deploy:
	$(SHELL) ./scripts/prod/pullmasteranddeploy.sh

# Reboot the server (for production)
.PHONY: reboot
reboot:
	$(SHELL) ./scripts/prod/reboot.sh
