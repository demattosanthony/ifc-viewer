---
description: git commit and push
model: anthropic/claude-sonnet-4-5
subtask: true
---

# Git Commit and Push

First, run `git pull --rebase` to sync with remote.

If there are rebase conflicts, DO NOT attempt to fix them. Stop immediately and notify me about the conflicts so I can resolve them manually.

If rebase succeeds, proceed with committing and pushing the changes.

## Commit Message Prefixes

Use one of these prefixes based on what changed:

| Prefix       | When to use                                               |
| ------------ | --------------------------------------------------------- |
| `web:`       | Changes in `apps/web/` (frontend application)             |
| `server:`    | Changes in `apps/server/` (Elysia backend)                |
| `core:`      | Changes in `packages/core/` (domain entities, services)   |
| `infra:`     | Changes in `packages/infrastructure/` (database, storage) |
| `interface:` | Changes in `packages/interface/` (DTOs, controllers)      |
| `viewer:`    | Changes in `packages/ifc-viewer/` (Three.js viewer)       |
| `sdk:`       | Changes in `packages/sdk/` (API client)                   |
| `ui:`        | Changes in `packages/ui/` (shared components)             |
| `ci:`        | Changes to CI/CD, GitHub Actions, build config            |
| `docs:`      | Documentation changes (README, AGENTS.md, etc.)           |
| `wip:`       | Work in progress, incomplete changes                      |

If changes span multiple packages, use the most significant one or combine them (e.g., `web,server:`).

## Commit Message Guidelines

- Explain WHY the change was made from an end user perspective, not WHAT was changed
- Be specific about user-facing impact
- Avoid generic messages like "improved viewer experience" or "updated components"

### Good examples:

- `web: users can now filter IFC elements by category in the sidebar`
- `viewer: selected elements now highlight with outline instead of color change for better visibility`
- `server: file uploads now show progress percentage during transfer`
- `core: project names now support unicode characters`

### Bad examples:

- `web: updated components` (too vague)
- `viewer: refactored selection logic` (describes WHAT not WHY)
- `server: improved API` (not specific)

## Process

1. Run `git pull --rebase`
2. If conflicts exist, STOP and notify me
3. Check `git status` and `git diff --staged` to understand changes
4. Determine appropriate prefix based on changed files
5. Write a specific, user-focused commit message
6. Commit and push
