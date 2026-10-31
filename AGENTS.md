# Repository Guidelines

## Required Reading Before Every Task

Before planning, editing files, or running project commands for a new task, read these files in order:

1. [`rules/rules.md`](rules/rules.md) — current working rules, version/release policy, and work history.
2. [`rules/requirements.md`](rules/requirements.md) — accumulated user requirements, later revisions, and outstanding verification.

Repeat this reading when resuming work after a context reset. Then read the task-specific documentation linked from these files. The latest explicit user instruction takes precedence over older requirements and historical work notes; preserve superseded requests as history rather than applying them as current rules.

Record new or changed user requirements in `rules/requirements.md` as part of the task. Keep implementation details distinct from user requests, and do not treat suggested future work as an approved requirement. Record changes, verification, and remaining work in `rules/rules.md` and `CHANGELOG.md`.

## Project Structure & Module Organization

`wook-post` provides **wPost**, a Korean-language Windows x64 API client built with Electron, React, TypeScript, and SQLite.

- `src/main/`: HTTP requests, SQLite storage, file transfers, and Electron IPC.
- `src/preload/`: restricted desktop APIs exposed to the renderer.
- `src/renderer/`: React UI, styles, and bundled fonts.
- `src/shared/`: shared types, validation schemas, and helpers.
- `tests/`: unit/integration tests; `tests/e2e/` contains Electron UI scenarios.
- `scripts/`, `build/`, and `assets/`: build/release tools and branding assets.
- `rules/`: working rules, user requirements, and work history.
- `docs/`: usage, development, branding, release, and verification guides.

Keep the root `README.md` concise, with an introduction, screenshot, download link, and documentation links. Put detailed instructions in `docs/`. Local `resources/` and generated `release/<version>/` artifacts remain untracked; preserve `release/README.md`.

## Build, Test, and Development Commands

Prerequisites: Node.js 24 or newer, npm, and Git. See [`docs/development.md`](docs/development.md) for setup and platform details.

- `npm ci`: install the locked dependencies.
- `npm run dev`: start the Electron development app.
- `npm run demo:server`: run the local API test server.
- `npm run build`: sync license notices, check types, and build production bundles.
- `npm run check`: run TypeScript, Prettier, and unit/integration checks.
- `npm run test:e2e`: build and run Electron UI tests; use `xvfb-run -a npm run test:e2e` on headless Linux.
- `npm run format:check`: check formatting of configured source and documentation files.
- `npm run dist:win`: build a Windows x64 NSIS installer and SHA-256 checksum locally.

Follow [`docs/releasing.md`](docs/releasing.md) for version changes and GitHub publication. Document new prerequisites and commands in `docs/development.md`.

## Coding Style & Naming Conventions

Use TypeScript strict mode, 2-space indentation, and the repository's Prettier configuration. Use PascalCase for React components and camelCase for functions and variables. Follow existing patterns and keep renderer access limited to the preload API.

For Markdown, use descriptive headings, fenced code blocks for multiline commands, and backticks for paths and identifiers. Keep documentation concise and end text files with a newline.

## Testing Guidelines

Use Vitest for `*.test.ts` unit/integration tests and Playwright for `tests/e2e/*.spec.ts` Electron scenarios. Tests use local HTTP servers and temporary databases. Use descriptive behavior-based names and include regression coverage for bug fixes when applicable.

For executable changes, run `npm run check` and the relevant Electron scenarios when UI behavior changes. For documentation-only changes, verify referenced paths and commands, run `npm run format:check`, and run `git diff --check`. Report actual checks and any unverified scope; packaging checks do not establish successful installation on Windows.

## Commit & Pull Request Guidelines

Work on `main`; do not create version-specific feature branches. Use short, imperative commit subjects such as `Document requirements and task startup rules`, and keep commits focused on one change. Before committing, inspect `git status --short`, `git diff`, and `git diff --check`. Do not force-push `main` or move existing version tags.

Use `package.json` and `package-lock.json` for app versions, Git tags for version history, and `release/<version>/` for local installers. A documentation-only change does not require a new app version or installer. Publish releases only as required by the current task and the release policy in `rules/rules.md`.

Pull requests should explain the purpose, summarize changes, and state how they were verified. Link relevant issues when available. Include screenshots for visible interface changes and flag any new setup steps or dependencies.
