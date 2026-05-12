import React from 'react'
import { render, Box, Text } from 'ink'
import { existsSync } from 'fs'
import { join } from 'path'
import { detectIDEs } from '../lib/ides.js'
import { readLock, writeLock } from '../lib/lock.js'
import { readRules, writeRules, createEmptyRules, listStages } from '../lib/rules.js'
import { syncGitignore } from '../lib/ignorer.js'
import { Header, IDEItem, Hint, StatusLine } from '../ui.jsx'

export async function init() {
  const cwd = process.cwd()
  const ides = detectIDEs(cwd)

  if (ides.length === 0) {
    const { unmount } = render(
      <Box flexDirection="column" gap={1}>
        <StatusLine variant="warning">No IDE directories detected.</StatusLine>
        <Text dimColor>Create one of: .claude/  .cursor/  .windsurf/  .agents/  .openhands/</Text>
      </Box>
    )
    unmount()
    return
  }

  const lockPath = join(cwd, 'skills-lock.json')
  const lockExists = existsSync(lockPath)
  const rulesPath = join(cwd, 'skills.rules')
  const rulesExists = existsSync(rulesPath)

  if (!lockExists) writeLock({ version: 1, skills: {} }, cwd)
  if (!rulesExists) writeRules(createEmptyRules(), cwd)
  const lock = readLock(cwd)
  const rules = readRules(cwd)
  syncGitignore(cwd, ides, lock)
  const skillCount = Object.keys(lock.skills).length
  const stages = listStages(rules)

  const { unmount } = render(
    <Box flexDirection="column" gap={1}>
      <Header>skill-rules init</Header>

      <Box flexDirection="column">
        <Text dimColor>IDEs detected ({ides.length})</Text>
        {ides.map(ide => <IDEItem key={ide.id} ide={ide} />)}
      </Box>

      <Box flexDirection="column">
        <StatusLine variant={lockExists ? 'info' : 'success'}>
          skills-lock.json{lockExists ? ` — already exists (${skillCount} skill${skillCount !== 1 ? 's' : ''})` : ' — created'}
        </StatusLine>
        <StatusLine variant={rulesExists ? 'info' : 'success'}>
          skills.rules{rulesExists ? ` — already exists (stages: ${stages.join(', ') || 'none'})` : ' — created (empty)'}
        </StatusLine>
        <StatusLine variant="success">.gitignore — updated</StatusLine>
      </Box>

      <Box flexDirection="column">
        <Hint>1. Install skills:  skills.sh or autoskill</Hint>
        <Hint>2. Assign stages:  skill-rules add</Hint>
        <Hint>3. Sync IDEs:      npx skill-rules</Hint>
      </Box>
    </Box>
  )
  unmount()
}
