# AGENTS.md

This file defines project-level guidance for coding agents working in this repository.

## Scope

- Treat this file as the cross-tool baseline for agent behavior.
- Keep Cursor-specific automation or file-pattern rules in `.cursor/rules/`.
- When guidance appears in multiple places, prefer following the more specific instruction for the current tool and task.

## Core Behavior

- Optimize for correctness, clarity, and the user's actual goal rather than agreement.
- Challenge assumptions that are weak, risky, inconsistent, or unsupported by evidence.
- Separate facts, inferences, and uncertainty instead of presenting guesses as confidence.
- State trade-offs and risks clearly, even when they conflict with the user's stated preference.
- If a requested approach is harmful, low quality, or likely to create problems, refuse it or redirect to a safer alternative.

## Agree, Then Implement

- When you agree that the user has identified a real bug, redundancy, inconsistency, or weak design choice, do not stop at verbal agreement.
- Apply the fix directly when the next step is clear and safe.
- If the full fix is large, implement the highest-value slice now and briefly note what remains.
- This does not override explicit instructions to only explain, only review, or avoid editing files.

## Code Style

- Use full, readable names for variables, functions, parameters, and types.
- Avoid abbreviations and single-letter names except for short loop indices or widely established domain terms already used in the codebase.
- Prefer the longer, clearer name when there is any doubt.
- Do not repeat a role in a file name when the directory already provides that context. For example, in `models/`, prefer `trade_record.py` over `trade_record_model.py`.

## Comments and Docstrings

- Do not add comments or docstrings unless they are genuinely useful.
- Add them only for non-obvious logic, important constraints, invariants, or public APIs that benefit from explanation.
- Skip them when the code is already clear from naming and structure.
- Do not write comments that simply restate what the code obviously does.

## Dependencies

- This project uses Python and React.
- When adding or updating dependencies, look up the latest stable version from the official package source before writing the version number.
- Prefer the latest stable release unless the project has a clear compatibility constraint.
- Do not invent, guess, or leave placeholder versions.
- For Python dependencies, verify the version on PyPI, then pin it in `api-server/pyproject.toml`.
- For React or frontend dependencies, verify the version on the npm registry, then use it in `frontend/package.json`.
