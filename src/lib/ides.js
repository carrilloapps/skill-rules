import { existsSync } from 'fs'
import { join } from 'path'

// All IDEs with native skills support from the agent skills spec
export const IDES = {
  claude: {
    name: 'Claude Code',
    detectDir: '.claude',
    skillsDir: '.claude/skills',
  },
  cursor: {
    name: 'Cursor',
    detectDir: '.cursor',
    skillsDir: '.cursor/skills',
  },
  windsurf: {
    name: 'Windsurf',
    detectDir: '.windsurf',
    skillsDir: '.windsurf/skills',
  },
  openhands: {
    name: 'OpenHands',
    detectDir: '.openhands',
    skillsDir: '.openhands/skills',
  },
  opencode: {
    name: 'OpenCode',
    detectDir: '.opencode',
    skillsDir: '.opencode/skills',
  },
  agents: {
    // Shared by: GitHub Copilot, Cline, VS Code, Codex, Kiro, and others
    name: 'Agents (Copilot, Cline, VS Code, Codex, Kiro)',
    detectDir: '.agents',
    skillsDir: '.agents/skills',
  },
}

export function detectIDEs(cwd = process.cwd()) {
  return Object.entries(IDES)
    .filter(([, ide]) => existsSync(join(cwd, ide.detectDir)))
    .map(([id, ide]) => ({ id, ...ide }))
}
