---
name: gh-create-pr
description: Create pull requests using GitHub CLI (gh pr create). Use when the user wants to create a PR, open a pull request via CLI, or use gh for PR creation.
---

# Create PR with GitHub CLI

Use [GitHub CLI](https://cli.github.com/manual/) to create pull requests from the terminal. Reference: [gh pr create](https://cli.github.com/manual/gh_pr_create).

## Prerequisites

- Authenticated: `gh auth login` or `GITHUB_TOKEN` set.
- Changes committed and branch pushed (or let `gh pr create` prompt to push).

## Quick workflow

1. Commit and push the branch (or run `gh pr create` and follow the push prompt).
2. Run one of the patterns below.

## Commands

**Interactive (prompts for title and body):**

```bash
gh pr create
```

**With title and body:**

```bash
gh pr create --title "Title" --body "Description"
```

**Auto-fill from commits:**

```bash
gh pr create --fill
```

Use `--fill-first` for first commit only, `--fill-verbose` for commit message + body.

**Draft PR:**

```bash
gh pr create --draft
```

**Specify base/head:**

```bash
gh pr create --base develop --head owner:branch
```

**From file body or template:**

```bash
gh pr create --body-file path/to/body.md
gh pr create --template pull_request_template.md
```

**Assign (e.g. self or others):**

```bash
gh pr create --assignee @me
gh pr create --assignee user1 --assignee user2
```

**Open in browser:**

```bash
gh pr create --web
```

## Common options

| Flag | Purpose |
|------|---------|
| `-t`, `--title` | PR title |
| `-b`, `--body` | PR body |
| `-B`, `--base` | Base branch (default: repo default or `gh-merge-base`) |
| `-H`, `--head` | Head branch (default: current) |
| `-d`, `--draft` | Create as draft |
| `-f`, `--fill` | Title/body from commits |
| `-e`, `--editor` | Open editor for title and body |
| `-a`, `--assignee` | Assign by login; use `@me` to self-assign (repeat for multiple) |
| `-r`, `--reviewer` | Request reviewers (e.g. `monalisa,hubot` or `org/team`) |
| `-l`, `--label` | Add labels |
| `-R`, `--repo` | `[HOST/]OWNER/REPO` for another repo |

## Tips

- Use `Fixes #123` or `Closes #123` in the body to auto-close the issue on merge.
- `--dry-run` prints what would be done; may still push.
- `--recover <file>` recovers input from a failed run.
- Projects require `project` scope: `gh auth refresh -s project`.
