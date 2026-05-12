import React from 'react'
import { render, Box, Text } from 'ink'
import figures from 'figures'
import { detectIDEs } from '../lib/ides.js'
import { readLock } from '../lib/lock.js'
import { updateGitignore, buildIgnorePatterns } from '../lib/ignorer.js'
import { Header, StatusLine } from '../ui.jsx'

export async function ignore() {
  const cwd = process.cwd()
  const ides = detectIDEs(cwd)

  if (ides.length === 0) {
    const { unmount } = render(
      <StatusLine variant="warning">No IDE directories detected. Nothing to ignore.</StatusLine>
    )
    unmount()
    return
  }

  const lock = readLock(cwd)
  const tracked = Object.entries(lock.skills)
    .filter(([, i]) => i.track)
    .map(([n]) => n)
  const patterns = buildIgnorePatterns(ides, tracked)
  updateGitignore(cwd, patterns)

  const { unmount } = render(
    <Box flexDirection="column" gap={1}>
      <Header>.gitignore updated</Header>
      <Box flexDirection="column">
        {patterns.map((p) => (
          <Box key={p} gap={2}>
            <Text color={p.startsWith('!') ? 'green' : 'yellow'}>
              {p.startsWith('!') ? figures.tick : figures.pointerSmall}
            </Text>
            <Text>{p}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
  unmount()
}
