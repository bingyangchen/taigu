# Agent Instructions

This file defines project-level guidance for coding agents working in this repository.

## Language

- Write code, identifiers, and code comments in English.
- Write the README and agent skills in English, except the `sdd` skill's templates, which follow the language of the documents they produce.
- Specs, plans, the roadmap, PR descriptions, and the manual checks in `tests/manual/` follow the language rules in the `sdd` skill.

## Spec-Driven Development

This repo uses spec-driven development: every change to spec'd behavior or architecture starts from a plan, and code follows. Before making any change to this repo (code, docs, or config), load the `sdd` skill and follow it. When the user asks for a change that alters spec'd behavior or architecture, the first deliverable is a plan PR, or a backfill PR when the capability has no spec yet, not code.

Before making product, UI, architecture, API, or database decisions, read the documents in `docs/specs/`:

- `product.md` records the positioning, target users, scope (including the pricing plans), non-goals, and glossary.
- `architecture.md` records the services, deployment, data model, the feature-to-code map (which also shows which capabilities have a spec), and the domain rules of capabilities that have no spec yet.
- `ui-guidelines.md` records the rules that every screen and every piece of UI copy follow.
- Every other file is the spec of one capability.

When reading docs for any purpose:

- `docs/specs/` describes what the code on the `main` branch implements now. The exceptions are the positioning, target users, scope, and non-goals in `product.md`, and the whole of `ui-guidelines.md`, which describe the intended product, including what is not built yet.
- `docs/plans/` and `docs/plans/roadmap.md` describe approved and future changes, not current behavior.
- `docs/plans/archive/` is history. Never treat it as current guidance.

Never push to `main` and never merge a PR. The user merges.

## Notes for Local Development

- Refer to the @Makefile to view the commands for local development.
- The backend and frontend environments exist only inside Docker. Do not run commands such as `python`, `poetry`, or `npm` directly on the host; see `compose.dev.yaml` for the containers to run them in. For Django management commands, use the container's Python instead of `poetry run`, for example `docker compose -f compose.dev.yaml exec api-server python manage.py migrate`.
- To add or remove a dependency, follow "Dependency Management" in `README.md`.
- Access the web app at `https://local.taigu.tw` instead of `http://localhost:3000` when running the local development server.
- When running `ruff format` or `ruff check`, always use the `--no-cache` option to prevent cache to be generated.
