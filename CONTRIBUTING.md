# Contributing to skill-rules

Thank you for your interest in contributing. This document covers everything you need to get started.

---

## Development setup

```bash
git clone https://github.com/carrilloapps/skill-rules.git
cd skill-rules
npm install
npm run dev        # watch mode — rebuilds on every change
```

The CLI is built with [esbuild](https://esbuild.github.io/) into `dist/index.js`. The source is ESM TypeScript-style JSX (React + [Ink](https://github.com/vadimdemedes/ink) for terminal UI).

To test your changes manually, link the package globally and run against a temporary project:

```bash
npm run build
npm link

# macOS / Linux
mkdir ~/sr-test && cd ~/sr-test && mkdir .claude

# Windows (PowerShell)
mkdir $HOME\sr-test; cd $HOME\sr-test; mkdir .claude

sr init
sr help
sr --version
```

Unlink when done: `npm unlink -g skill-rules`

---

## Project structure

```
src/
├── index.jsx            # entry point
├── cli.jsx              # commander setup — all commands registered here
├── ui.jsx               # shared Ink components (Header, StatusLine, ListSelect…)
├── commands/
│   ├── run.jsx          # default sync command
│   ├── init.jsx         # sr init
│   ├── add.jsx          # sr add
│   ├── remove.jsx       # sr remove
│   ├── use.jsx          # sr use
│   ├── list.jsx         # sr list
│   ├── ignore.jsx       # sr ignore
│   └── help.jsx         # sr help
└── lib/
    ├── ides.js          # IDE definitions and detection
    ├── lock.js          # skills-lock.json read/write
    ├── rules.js         # skills.rules read/write and helpers
    ├── ignorer.js       # .gitignore block management
    ├── syncer.js        # skill directory copy logic
    ├── stash.js         # stash/restore skill directories
    ├── state.js         # active stage state (.skill-rules/state.json)
    └── copy.js          # shared copyDirSync utility
```

---

## Architecture principles

**Two files, two owners.**
`skills-lock.json` is owned by external installers (`autoskill`, `skills.sh`). `skill-rules` never writes skill entries there — it only reads it and manages the `track` flag via `sr list`. `skills.rules` is fully owned by `skill-rules`.

**No fullscreen UI.**
Wizards are linear, top-to-bottom flows rendered inline in the terminal. No alternate screen buffer, no back navigation.

**Confirmation only when destructive.**
`sr use <stage>` only asks for confirmation when skills will be moved to the stash (removed from IDE directories). If the operation is purely additive (restore + sync), it runs immediately.

**Stash over delete.**
The `use` command never permanently deletes skill directories. It moves them to `.skill-rules/stash/` — a local, gitignored directory — so switching stages is always reversible without reinstalling.

**Tracked skills are untouchable.**
Skills marked `track: true` in `skills-lock.json` are committed to the repository and must always be available. `sr use` never stashes them.

---

## Adding a new IDE

1. Add an entry to the `IDES` object in `src/lib/ides.js`:

```js
mynewIDE: {
  name: 'My New IDE',
  detectDir: '.mynewIDE',
  skillsDir: '.mynewIDE/skills',
},
```

2. Update the IDE support table in `README.md`.

---

## Submitting changes

1. Fork the repository and create a branch from `main`.
2. Keep each pull request focused on a single concern.
3. Verify: `npm run build && npm run lint && npm run test:coverage`, then `npm link` and run `sr init` and `sr help` in a test directory.
4. Update `CHANGELOG.md` under `[Unreleased]` with a summary of your changes.
5. Open the pull request — describe what changed and why, not how.

---

## Reporting issues

Please use [GitHub Issues](https://github.com/carrilloapps/skill-rules/issues). Include:

- Node.js version (`node --version`)
- OS and shell
- The exact command you ran
- The full terminal output

---

## Code style

- ESM only — no CommonJS
- No TypeScript compilation, but JSDoc types are welcome on public functions
- Unit tests live in `test/lib/` and cover all `src/lib/` modules at 100% — run with `npm test`
- No comments unless the *why* is non-obvious (a workaround, a hidden invariant)
- Keep UI messages consistent with existing tone: lowercase, concise, no punctuation at line end

---

## License

By contributing you agree that your contributions will be licensed under the [MIT License](./LICENSE).
