# Agent Instructions

This file defines project-level guidance for coding agents working in this repository.

## Product and Architecture Reference

Before making product, UI, architecture, API, or database decisions, read `.agents/skills/app-context.md`. It records the product's purpose, the feature-to-file map, domain invariants, the data model, and the brand and copy constraints. If any of these change, update that file before continuing.

## Notes for Local Development

- Refer to the @Makefile to view the commands for local development.
- The backend and frontend environments exist only inside Docker. Do not run commands such as `python`, `poetry`, or `npm` directly on the host; see `compose.dev.yaml` for the containers to run them in. For Django management commands, use the container's Python instead of `poetry run`, for example `docker compose -f compose.dev.yaml exec api-server python manage.py migrate`.
- To add or remove a dependency, follow "Dependency Management" in `README.md`.
- Access the web app at `https://local.taigu.tw` instead of `http://localhost:3000` when running the local development server.
- When running `ruff format` or `ruff check`, always use the `--no-cache` option to prevent cache to be generated.
