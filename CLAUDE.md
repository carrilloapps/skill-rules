# CLAUDE.md — skill-rules

Guidance for Claude Code when working in this repository.

## What this project is

`skill-rules` is a Node.js CLI tool that syncs AI agent skills across multiple IDEs (Claude Code, Cursor, Windsurf, OpenHands, Agents/Copilot) and activates per-stage rule sets. It is published to npm as `skill-rules` with the `sr` alias.

## Commands you will use

```bash
npm run build          # compile src/ → dist/index.js via esbuild
npm run dev            # watch mode (rebuilds on save)
npm run lint           # eslint src/
npm run format         # prettier --write .
npm run format:check   # prettier --check . (what CI runs)
npm run test           # vitest run (no coverage)
npm run test:coverage  # vitest run --coverage (enforces 100% on src/lib/**)
node dist/index.js     # run the built CLI directly
```

Run `npm run build && npm run lint && npm run format:check && npm run test:coverage` before any commit — that is exactly what CI runs.

## Architecture

```
src/
├── index.jsx          # entry point — parseAsync(process.argv)
├── cli.jsx            # commander setup, all commands registered
├── ui.jsx             # shared Ink components: Header, StatusLine, ListSelect, Hint, IDEItem, SkillStatus
├── commands/
│   ├── run.jsx        # default command (sr) — sync active skills
│   ├── init.jsx       # sr init
│   ├── add.jsx        # sr add [skill]
│   ├── remove.jsx     # sr remove [skill]
│   ├── use.jsx        # sr use [stage]
│   ├── list.jsx       # sr list
│   ├── ignore.jsx     # sr ignore
│   ├── help.jsx       # sr help
│   └── mcp.js         # sr mcp — starts MCP server
└── mcp/
    └── server.js      # MCP server: 8 tools, stdio transport, no Ink

src/lib/               # pure logic, no Ink — 100% unit tested
    ides.js            # IDES constant + detectIDEs(cwd)
    lock.js            # skills-lock.json read/write/setSkillTracked
    rules.js           # skills.rules read/write + stage helpers
    ignorer.js         # .gitignore block management (skill-rules markers)
    syncer.js          # copy skill dirs across IDEs
    stash.js           # move skills to/from .skill-rules/stash/
    state.js           # .skill-rules/state.json (active stage per machine)
    copy.js            # copyDirSync utility

test/lib/              # vitest unit tests, one file per lib module
```

## Key invariants

- **`src/lib/` has zero Ink/React dependencies.** All terminal UI lives in `commands/`. This is why 100% unit test coverage is achievable there.
- **Two files, two owners.** `skills-lock.json` is written by external installers (`autoskill`, `skills.sh`); `skill-rules` only reads it and manages the `track` flag. `skills.rules` is fully owned by `skill-rules`.
- **No fullscreen UI.** Ink renders inline — no alternate screen buffer, no `process.stdout.write('\x1b[?1049h')`.
- **Stash over delete.** `sr use` never deletes skill directories; it moves them to `.skill-rules/stash/` and restores them later.
- **Tracked skills are never stashed.** Skills with `track: true` in `skills-lock.json` are always available.
- **`.skill-rules/` is always gitignored.** Never modify this rule.

## Code conventions

- ESM only — no `require()`, no `.cjs`
- No TypeScript — plain JSX/JS with JSDoc types on public functions if helpful
- Prettier config: no semicolons, single quotes, `trailingComma: 'es5'`, `printWidth: 100`
- ESLint flat config (v9) — `eslint.config.js`
- Comments only for non-obvious WHY — never WHAT
- No `console.log` in library code; status output goes through Ink components in commands

## Testing rules

- Tests live in `test/lib/` — one file per `src/lib/` module
- Every test creates a temp dir via `join(tmpdir(), 'sr-test-<module>-' + Date.now())` and removes it in `afterEach`
- The 100% coverage threshold is enforced — adding lib code without tests will fail CI
- `src/commands/` and `src/ui.jsx` are intentionally excluded from coverage (Ink components are integration-tested manually)

## Files that must never be committed

- `dist/` — build output
- `coverage/` — coverage reports
- `node_modules/`
- `.skill-rules/` — local machine state
- `.claude/skills`, `.cursor/skills`, `.windsurf/skills`, `.agents/skills`, `.openhands/skills`

## Dependency policy

All dependencies use `~` (tilde) ranges — patch-level updates only. Do not upgrade to `~X.(Y+1).0` without verifying peer dep compatibility. ESLint is pinned to v9 (`~9.39.0`) because `eslint-plugin-react@7.x` does not support ESLint v10.

## Build output

esbuild bundles `src/index.jsx` → `dist/index.js`:

- `format: 'esm'`, `packages: 'external'` (all deps remain external)
- `banner: { js: '#!/usr/bin/env node' }` (shebang injected)
- Node.js >= 20 required at runtime
