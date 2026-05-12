import React from 'react'
import { render, Box, Text } from 'ink'
import { Header, Hint } from '../ui.jsx'

const COMMANDS = [
  { cmd: 'sr', desc: 'Sync all active skills across every detected IDE' },
  { cmd: 'sr init', desc: 'Create config files and update .gitignore' },
  { cmd: 'sr add [skill]', desc: 'Assign skills to stages' },
  { cmd: 'sr remove [skill]', desc: 'Remove skill-to-stage assignments' },
  { cmd: 'sr use [stage]', desc: 'Activate a stage — stash / restore skills' },
  { cmd: 'sr use --off', desc: 'Restore all stashed skills, clear active stage' },
  { cmd: 'sr list', desc: 'Manage git tracking for skills' },
  { cmd: 'sr ignore', desc: 'Regenerate .gitignore skill-rules block' },
  { cmd: 'sr help', desc: 'Show this help' },
]

const OPTIONS = [
  { flag: '--stage <name>', desc: 'Limit sync to a specific stage' },
  { flag: '--version', desc: 'Show version number' },
  { flag: '<command> --help', desc: 'Show detailed help for a command' },
]

const CMD_W = Math.max(...COMMANDS.map((c) => c.cmd.length)) + 2
const OPT_W = Math.max(...OPTIONS.map((o) => o.flag.length)) + 2

export async function help() {
  const { unmount } = render(<HelpUI />)
  unmount()
}

function HelpUI() {
  return (
    <Box flexDirection="column" gap={1}>
      <Header>skill-rules</Header>
      <Text dimColor>Sync AI agent skills across IDEs with per-stage rules</Text>

      <Box flexDirection="column">
        <Text bold>Commands</Text>
        {COMMANDS.map(({ cmd, desc }) => (
          <Box key={cmd} gap={2}>
            <Text color="cyan">{cmd.padEnd(CMD_W)}</Text>
            <Text>{desc}</Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column">
        <Text bold>Options</Text>
        {OPTIONS.map(({ flag, desc }) => (
          <Box key={flag} gap={2}>
            <Text color="yellow">{flag.padEnd(OPT_W)}</Text>
            <Text dimColor>{desc}</Text>
          </Box>
        ))}
      </Box>

      <Hint>https://github.com/carrilloapps/skill-rules</Hint>
    </Box>
  )
}
