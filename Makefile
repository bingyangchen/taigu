.PHONY: build-dev
build-dev:
	$(SHELL) ./scripts/dev/build.sh

.PHONY: start-dev
start-dev:
	$(SHELL) ./scripts/dev/start.sh

.PHONY: stop-dev
stop-dev:
	$(SHELL) ./scripts/dev/stop.sh

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
