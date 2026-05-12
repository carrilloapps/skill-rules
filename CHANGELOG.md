# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- `sr help` — styled Ink command listing all commands and options

### Removed

- `sr pg` — playground command removed; use a local test project instead

---

## [0.1.0] — 2026-05-12

### Added

- `skill-rules` (alias `sr`) CLI binary — syncs AI agent skills across Claude Code, Cursor, Windsurf, OpenHands, and Agents-compatible IDEs
- `sr init` — creates `skills-lock.json`, `skills.rules`, and updates `.gitignore`
- `sr add [skill]` — interactive wizard and CLI mode to assign skills to stages; supports `--stage` and `--track`
- `sr remove [skill]` — interactive wizard and CLI mode to remove skill-to-stage assignments; supports `--stage`
- `sr use [stage]` — activates a stage by stashing non-target skills to `.skill-rules/stash/` and restoring target skills; shows confirmation only when destructive
- `sr use --off` — restores all stashed skills and clears the active stage
- `sr list` — interactive git tracking manager; supports `--track` and `--untrack`
- `sr ignore` — regenerates the `# skill-rules [start/end]` block in `.gitignore`
- Per-stage skill filtering — `skills.rules` JSON file maps skill names to stage arrays
- Local machine state — `.skill-rules/state.json` tracks the active stage per machine (gitignored)
- Stash system — `.skill-rules/stash/` stores stashed skill directories locally without touching git
- Automatic `.gitignore` management — IDE skill directories gitignored by default; tracked skills get negation rules
- Git tracking — individual skills can be committed to the repository via `--track` or `sr list`
- `sr` short alias registered alongside `skill-rules` in `package.json` bin

[Unreleased]: https://github.com/carrilloapps/skill-rules/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/carrilloapps/skill-rules/releases/tag/v0.1.0
