# Taigu

<p align="center">
  <img src="./frontend/public/logo-l.png" alt="Taigu Logo" width="100">
</p>

![GitHub contributors](https://img.shields.io/github/contributors/bingyangchen/taigu?style=flat-square&logo=github&logoColor=white&label=Contributors&color=2ea44f) ![GitHub commit activity](https://img.shields.io/github/commit-activity/t/bingyangchen/taigu/main?style=flat-square&label=Total%20Commits&color=0969da) ![GitHub commit activity](https://img.shields.io/github/commit-activity/w/bingyangchen/taigu/main?style=flat-square&label=Weekly%20Commits&color=ffd43b) ![GitHub last commit (branch)](https://img.shields.io/github/last-commit/bingyangchen/taigu/main?style=flat-square&label=Last%20Commit&color=cf222e) ![GitHub code search count](https://img.shields.io/github/search?query=taigu&label=Search&style=flat-square&color=6f42c1) ![Docker Pulls](https://img.shields.io/docker/pulls/taigutw/api-server?style=flat-square&color=0db7ed&label=Docker%20Pulls)

## 🔍 Overview

### Architecture

#### Development

```mermaid
architecture-beta
    group localhost(server)[Localhost]
    service db(database)[Relational Database] in localhost
    service in_mem_cache(database)[In Memory Cache] in localhost
    service api_server(server)[API Server] in localhost
    service frontend(server)[Static File Server] in localhost
    service reverse_proxy(server)[Reverse Proxy] in localhost
    service scheduler(server)[Scheduler] in localhost
    service internet(internet)[Internet]

    internet:B --> T:reverse_proxy
    reverse_proxy:R --> L:api_server
    reverse_proxy:L --> R:frontend
    api_server:R --> L:db
    api_server:B --> L:in_mem_cache
    scheduler:L --> R:db
    scheduler:B --> R:in_mem_cache
```

#### Production

```mermaid
architecture-beta
    group ec2(cloud)[AWS EC2]
    service db(database)[Relational Database] in ec2
    service in_mem_cache(database)[In Memory Cache] in ec2
    service api_server(server)[API Server] in ec2
    service reverse_proxy(server)[Reverse Proxy] in ec2
    service scheduler(server)[Scheduler] in ec2
    service internet(internet)[Internet]
    service cloudflare(cloud)[Cloudflare]
    service cloudflare_pages(server)[Cloudflare Pages]
    service github(server)[GitHub]

    internet:B --> T:cloudflare
    cloudflare:L --> R:cloudflare_pages
    cloudflare_pages:B --> T:github
    cloudflare:B --> T:reverse_proxy
    reverse_proxy:R --> L:api_server
    api_server:R --> L:db
    api_server:B --> L:in_mem_cache
    scheduler:L --> R:db
    scheduler:B --> R:in_mem_cache
```

### Branches

```mermaid
%%{init: { 'theme': 'base', 'gitGraph': {'showCommitLabel': false}} }%%
gitGraph
   commit
   commit
   branch plan/0001-xxx
   switch plan/0001-xxx
   commit
   commit
   switch main
   merge plan/0001-xxx
   commit
   branch impl/0001-xxx
   switch impl/0001-xxx
   commit
   commit
   switch main
   merge impl/0001-xxx
   commit
```

### Tech Stack

- API Server
  - Programming Language: Python
  - Framework: Django
- Frontend
  - Programming Language: TypeScript
  - Framework: React
- Database: PostgreSQL
- Cache: Redis
- Reverse Proxy: Nginx
- Scheduler
  - Programming Language: Python

## 🧑🏻‍💻 Development

### Prerequisites

- Operating System: MacOS or Linux
- Git (>=2.34.0)
- GNU Make (>=3.81.0)
- Docker (>=27.4.0)
- Visual Studio Code (or any other editor that supports devcontainer)

### Quick Start

- Step 0: Clone the repository

  ```bash
  git clone git@github.com:bingyangchen/taigu.git
  cd taigu
  ```

- Step 1: Create .env file

  ```bash
  cp example.env .env
  ```

  Fill in the values for the environment variables.

- Step 2: Build the images for development

  ```bash
  make build-dev
  ```

- Step 3: Initialize Development Environment

  ```bash
  make setup-dev
  ```

  This command will:
  - Add `local.taigu.tw` to your `/etc/hosts` file (requires `sudo`) so you can access the local server via domain name.
  - Generate development SSL certificates and keys under `reverse-proxy/` matching `local.taigu.tw` (uses [mkcert](https://github.com/FiloSottile/mkcert) when installed so browsers trust HTTPS and service workers work locally).
  - Install Git hooks in `.git/hooks/` to run automatic pre-commit linting and testing.

- Step 4: Run the Development Server

  ```bash
  make start
  # To stop the server, run `make stop`
  ```

  Once started, the application will automatically open or be accessible at `https://local.taigu.tw` in your browser.

### The Development Workflow

- **Step 1:** Create a branch from `main`, named as [Spec-Driven Development](#spec-driven-development) describes.
- **Step 2:** Complete your work, then commit and push your changes.
- **Step 3:** Open a pull request on GitHub and obtain approval for your PR.
- **Step 4:** Merge your branch into `main`.
- **Step 5:** Build new images for **production** from the latest `main` on your local machine.
- **Step 6:** Push the new images to Docker Hub.
- **Step 7:** SSH into the EC2 instance, pull the latest code and images.
- **Step 8:** Restart all Docker containers. You're done!

### Spec-Driven Development

Every change to spec'd behavior or architecture starts from a plan, and code follows. The full workflow is in `.agents/skills/sdd/SKILL.md`.

- `docs/specs/` describes what the code on `main` implements: the product, the architecture, the UI guidelines, and one spec per capability.
- `docs/plans/` holds approved changes, and `docs/plans/roadmap.md` shows what comes next.
- `tests/manual/` holds the steps for the scenarios that need a manual check.
- A change that alters behavior goes through a `plan/NNNN-xxx` branch, then an `impl/NNNN-xxx` branch. A behavior-preserving change, such as a bug fix that restores spec'd behavior or a refactor, uses a `change/xxx` branch, writing the spec of an existing capability uses a `backfill/xxx` branch, and abandoning an approved plan uses an `abandon/NNNN-xxx` branch. A trivial change on the skill's whitelist, such as a typo fix, takes any branch name.
- `make check-scenarios` checks that every scenario in `docs/specs/` has a test or a manual check; `make test` and CI run it too.

### Dependency Management

Let's dive deeper into the details of **Step 2** of the development workflow when you need to add or remove a dependency:

#### API Server

- **Step 2-1:** Enter the shell of the API server container.
- **Step 2-2:** Install/Remove the dependency: `poetry add {DEPENDENCY} --lock` or `poetry remove {DEPENDENCY} --lock`
  - Note: The `--lock` flag prevents the download of the dependency, only version check will be performed.
- **Step 2-3:** Exit the shell and build the images for development.
- **Step 2-4:** Restart all Docker containers.

#### Frontend

- **Step 2-1:** Enter the shell of the frontend container.
- **Step 2-2:** Install/Remove the dependency: `npm install {DEPENDENCY} --save` or `npm remove {DEPENDENCY} --save`
- **Step 2-3:** Exit the shell and build the images for development.
- **Step 2-4:** Restart all Docker containers.

### Environment Variable Management

- **Step 1:** Define a new environment variable (with no value) in the `example.env` file.
- **Step 2:** Define the environment variable (with the value) in the `.env` file.
- **Step 3:** If it is used in the API server, you will also need to define the environment variable in `api-server/main/env.py` and `.github/workflows/lint-and-test.yaml`.

  You will also need to add the new environment variables into the `Test` environment on GitHub repository settings (Settings > Environments > Test > Variables/Secrets).

## 🚀 Production

### Prerequisites

- Operating System: Linux (Ubuntu >=22.04)
- Domain name: taigu.tw
- Git (>=2.34.0)
- GNU Make (>=3.81.0)
- Docker (>=27.4.0)

### One-Time Setup

```bash
git clone git@github.com:bingyangchen/taigu.git
cd ~/taigu
cp example.env .env

# [ACTION REQUIRED] Update ~/taigu/.env

# For running docker commands without sudo
sudo usermod -aG docker $USER
newgrp docker

make pull-images-prod
sudo timedatectl set-timezone Asia/Taipei
make start

# Restore the database from the backup:
docker cp ~/db-backups/backup.sql taigu-db-1:/backup.sql
make shell-db
    # In the db container:
    psql taigu < /backup.sql
    exit
```

### Deploying a New Version

```bash
cd ~/taigu
make deploy
```

### Environment Variable Management

You can view `example.env` as the template for environment variable requirements. When you modify the environment variable requirements in `example.env`, you must also update the corresponding environment variables in the `.env` file on the production server.
