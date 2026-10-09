# Repository Guidelines

## Project Structure & Module Organization

`wook-post` is at its initial setup stage. Root-level documentation consists of `README.md` and this guide; no source code, tests, or assets are present.

Keep repository-wide documentation at the root. As implementation begins, introduce clearly named directories such as `src/`, `tests/`, and `assets/` only where needed, and describe their roles in `README.md`.

## Build, Test, and Development Commands

No build system, dependency manifest, or application entry point is configured. Build, test, and local-server commands are not yet available.

Useful repository checks:

- `git status --short`: review changed and untracked files before committing.
- `git diff --check`: detect whitespace errors in tracked changes.
- `git diff`: inspect unstaged changes to tracked files.

When adding tooling, document prerequisites, installation steps, and exact development, build, lint, and test commands in `README.md`.

## Coding Style & Naming Conventions

No programming language, formatter, or linter has been selected. Follow surrounding conventions when editing files. Use descriptive names and consistent indentation; establish language-specific rules alongside the first implementation.

For Markdown, use descriptive headings, fenced code blocks for multiline commands, and backticks for paths and identifiers. Keep documentation concise and end text files with a newline.

## Testing Guidelines

No testing framework, test naming convention, or coverage threshold exists yet. When introducing executable code, add an appropriate test runner and document its invocation. Use descriptive test names that identify the behavior being verified. Include regression tests for bug fixes when applicable.

For documentation changes, verify referenced paths and commands and run `git diff --check`.

## Commit & Pull Request Guidelines

The Git history contains only `Initial commit`, so no established commit convention can be inferred. Use short, imperative subjects such as `Add development setup instructions`, and keep commits focused on one change.

Pull requests should explain the purpose, summarize changes, and state how they were verified. Link relevant issues when available. Include screenshots for visible interface changes and flag any new setup steps or dependencies.
