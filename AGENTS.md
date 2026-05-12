# AGENTS.md — skill-rules

Context for AI coding agents working in this repository.

## Project purpose

`skill-rules` is a Node.js CLI (npm package) that synchronizes AI agent skills across multiple IDEs and activates per-stage rule sets with a single command. It is the tool that manages this very type of file across a developer's machines.

Supported IDEs: Claude Code (`.claude/`), Cursor (`.cursor/`), Windsurf (`.windsurf/`), OpenHands (`.openhands/`), OpenCode (`.opencode/`), and the shared Agents directory (`.agents/`) used by GitHub Copilot, Cline, VS Code, Codex, and Kiro.

## Repository layout

```
skill-rules/
├── src/
│   ├── index.jsx            # CLI entry point
│   ├── cli.jsx              # commander v12 program definition
│   ├── ui.jsx               # shared Ink v5 terminal components
│   └── commands/            # one file per sr subcommand
│       ├── run.jsx          # sr (default sync)
│       ├── init.jsx         # sr init
│       ├── add.jsx          # sr add
│       ├── remove.jsx       # sr remove
│       ├── use.jsx          # sr use
│       ├── list.jsx         # sr list
│       ├── ignore.jsx       # sr ignore
│       ├── help.jsx         # sr help
│       └── mcp.js           # sr mcp (starts MCP server)
├── src/mcp/
│   └── server.js            # MCP server — 8 tools, stdio transport
├── src/lib/                 # pure logic — no UI dependencies
│   ├── ides.js              # IDE registry and detection
│   ├── lock.js              # skills-lock.json I/O
│   ├── rules.js             # skills.rules I/O and stage helpers
│   ├── ignorer.js           # .gitignore block management
│   ├── syncer.js            # cross-IDE skill directory sync
│   ├── stash.js             # stash and restore skill directories
│   ├── state.js             # per-machine active stage state
│   └── copy.js              # recursive directory copy
├── test/lib/                # vitest unit tests (100% coverage required)
├── dist/                    # build output — gitignored, do not edit
├── .github/
│   ├── workflows/ci.yml     # build + lint + format + coverage on Node 20/22
│   ├── dependabot.yml       # monthly patch-only updates + security alerts
│   ├── ISSUE_TEMPLATE/      # structured bug/feature forms
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── SECURITY.md
├── skills-lock.json         # installed skills (written by external installers)
├── skills.rules             # stage assignments (written by skill-rules)
├── package.json             # engines: node >=20, all deps use ~ ranges
├── esbuild.config.js        # bundle config
├── eslint.config.js         # flat config v9
├── vitest.config.js         # 100% coverage thresholds on src/lib/**
└── .gitattributes           # eol=lf for all files
```

## Development commands

| Command                 | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `npm run build`         | Compile `src/` → `dist/index.js`         |
| `npm run dev`           | Watch mode — rebuild on every change     |
| `npm run lint`          | ESLint on `src/`                         |
| `npm run format`        | Prettier write on all files              |
| `npm run format:check`  | Prettier check (what CI runs)            |
| `npm run test`          | Run tests without coverage               |
| `npm run test:coverage` | Run tests with 100% coverage enforcement |

CI runs exactly: `npm ci → build → lint → format:check → test:coverage → node dist/index.js --version`

## Technology stack

- **Runtime**: Node.js ESM, no TypeScript, JSX via esbuild
- **Terminal UI**: React 18 + Ink v5 + `@inkjs/ui` v2 (MultiSelect, TextInput, Spinner)
- **MCP**: `@modelcontextprotocol/sdk` v1.x — `Server` class, stdio transport, JSON Schema tools
- **CLI framework**: commander v12
- **Build**: esbuild (`packages: 'external'`, format `esm`, shebang banner)
- **Tests**: vitest v4 with `@vitest/coverage-v8`
- **Lint**: ESLint v9 flat config + `eslint-plugin-react`
- **Format**: Prettier v3 (no semicolons, single quotes, printWidth 100)

## Data model

### `skills-lock.json` (external ownership)

Written by skill installers (`autoskill`, `skills.sh`). `skill-rules` never creates or removes skill entries — it only reads this file and toggles the `track` flag via `sr list`.

```json
{
  "version": 1,
  "skills": {
    "review": {},
    "debug-tools": {},
    "security-audit": { "track": true }
  }
}
```

`track: true` means the skill directory is committed to git (negation rule in `.gitignore`).

### `skills.rules` (skill-rules ownership)

Stage assignments. Safe to commit.

```json
{
  "version": 1,
  "stages": {
    "dev": ["review", "debug-tools"],
    "qa": ["review", "linter"],
    "production": ["security-audit"]
  }
}
```

### `.skill-rules/state.json` (local machine, gitignored)

Persists the active stage per machine. Written by `sr use`, read by `sr` (sync) and `sr use`.

```json
{ "activeStage": "dev" }
```

### `.skill-rules/stash/` (local machine, gitignored)

Stores stashed skill directories. Each entry is a full copy of the original skill directory.

## Core behaviors

### IDE detection (`ides.js`)

Checks for `.claude`, `.cursor`, `.windsurf`, `.openhands`, `.opencode`, `.agents` directories at `cwd`. Returns only the IDEs present. All commands operate on detected IDEs only.

### Sync (`commands/run.jsx` + `lib/syncer.js`)

For each active skill, find IDEs that have it. Copy the skill directory from the first source to every IDE that is missing it. Skills missing from all IDEs are reported as `missing` — install them first.

### Stage activation (`commands/use.jsx`)

1. Build a plan: for each skill in the lock, determine `keep / restore / stash / missing / skip`
2. Skills in target stage → restore from stash if needed, then sync
3. Skills NOT in target stage AND in another stage → stash (move to `.skill-rules/stash/`)
4. Skills with `track: true` → always `skip` (never touched)
5. Skills in no stage → always `skip` (always available)
6. Only show confirmation prompt when at least one skill will be stashed

### `.gitignore` management (`lib/ignorer.js`)

Maintains a `# skill-rules [start]` / `# skill-rules [end]` block. The block always includes:

- `.skill-rules/` (local state)
- Each detected IDE's `skillsDir` (e.g. `.claude/skills`, `.opencode/skills`)
- Negation rules for tracked skills (e.g. `!.claude/skills/security-audit`)

The block is replaced atomically on every `sr ignore` or `sr add --track`.

## Architectural constraints

1. **`src/lib/` has no Ink/React imports.** It is pure Node.js logic, fully unit-testable. Do not import from Ink in lib files.
2. **No fullscreen UI.** All terminal output is inline — no alternate buffer, no `clear`.
3. **Stash over delete.** `sr use` never calls `rmSync` on skill directories directly — it always moves to stash first via `stashSkill()`.
4. **Tracked skills are never stashed.** Check `lock.skills[name]?.track` before any stash operation.
5. **`skills-lock.json` entries are never created by this tool.** Only external installers write skill entries. `skill-rules` only sets/clears `track`.
6. **ESM only.** No `require()`, no `.cjs` files, no dynamic `import()` unless absolutely necessary.

## Testing conventions

- One test file per lib module in `test/lib/`
- Each test creates an isolated temp directory: `join(tmpdir(), 'sr-test-<module>-' + Date.now())`
- `beforeEach` creates the temp dir; `afterEach` removes it with `rmSync(tmp, { recursive: true, force: true })`
- 100% coverage on all four metrics (statements, branches, functions, lines) is enforced by CI
- `src/commands/` and `src/ui.jsx` are excluded from coverage requirements — test them manually

## Dependency constraints

All `package.json` ranges use `~` (tilde — patch-only). Do not change to `^`.

Key peer dep constraint: `eslint-plugin-react@7.x` supports only ESLint up to `~9.39.x`. Do not upgrade ESLint to v10 without first verifying the plugin supports it.

Node.js minimum: `>=20`. `vitest@4.x` uses `rolldown` which requires `node:util.styleText` (Node 20.12+).

## MCP server

`sr mcp` starts a stdio MCP server (`src/mcp/server.js`) that exposes all skill-rules operations as tools: `sync`, `status`, `init`, `add`, `remove`, `use`, `list`, `ignore`. The server is bundled into `dist/index.js` alongside the CLI.

Key design decisions:

- **No Ink/React.** Uses the `@modelcontextprotocol/sdk` `Server` class directly with JSON Schema tool definitions. Pure Node.js logic via the same `src/lib/` modules used by the commands.
- **CWD fixed at server start.** `process.cwd()` is captured once in `startMcpServer()` and reused by all tool handlers. The server must be started from the project root.
- **No confirmation prompts.** The `use` tool executes the stash/restore plan immediately — the calling agent is the decision-maker, unlike the interactive CLI which asks the user.
- **`src/mcp/` is excluded from the 100% coverage requirement** (only `src/lib/**` is enforced). The MCP server is integration-tested manually.

Configure in Claude Code via `.mcp.json`:

```json
{
  "mcpServers": {
    "skill-rules": {
      "command": "npx",
      "args": ["-y", "skill-rules", "mcp"]
    }
  }
}
```

## Publishing

Manual only. The maintainer runs:

```bash
npm run build
npm publish --dry-run
npm publish --access public --otp <OTP>
```

There is no automated publish workflow. Do not create one.
