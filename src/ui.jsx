import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import figures from 'figures'

const STATUS_ICON = {
  ok:      figures.tick,
  success: figures.tick,
  missing: figures.cross,
  error:   figures.cross,
  synced:  figures.bullet,
  warning: figures.warning,
  info:    figures.info,
}

const STATUS_COLOR = {
  ok:      'green',
  success: 'green',
  missing: 'red',
  error:   'red',
  synced:  'yellow',
  warning: 'yellow',
  info:    'cyan',
}

export function Header({ children }) {
  return (
    <Box marginBottom={1}>
      <Text bold>{children}</Text>
    </Box>
  )
}

export function IDEItem({ ide }) {
  return (
    <Box gap={2}>
      <Text color="green">{figures.tick}</Text>
      <Text>{ide.name}</Text>
      <Text dimColor>{ide.skillsDir}</Text>
    </Box>
  )
}

export function SkillStatus({ name, status, detail }) {
  return (
    <Box gap={1}>
      <Text color={STATUS_COLOR[status] ?? 'white'}>{STATUS_ICON[status] ?? figures.bullet}</Text>
      <Text bold>{name}</Text>
      {detail && <Text dimColor>{detail}</Text>}
    </Box>
  )
}

export function StatusLine({ variant, children }) {
  return (
    <Box gap={1}>
      <Text color={STATUS_COLOR[variant] ?? 'white'}>{STATUS_ICON[variant] ?? figures.bullet}</Text>
      <Text>{children}</Text>
    </Box>
  )
}

export function Hint({ children }) {
  return <Text dimColor>  {children}</Text>
}

export function ListSelect({ options, onSelect }) {
  const [index, setIndex] = useState(0)

  useInput((_, key) => {
    if (key.upArrow) setIndex(i => Math.max(0, i - 1))
    else if (key.downArrow) setIndex(i => Math.min(options.length - 1, i + 1))
    else if (key.return) onSelect(options[index].value)
  })

  return (
    <Box flexDirection="column">
      {options.map((opt, i) => (
        <Box key={opt.value} gap={1}>
          <Text color={i === index ? 'cyan' : undefined}>
            {i === index ? figures.pointerSmall : ' '}
          </Text>
          <Text color={i === index ? 'cyan' : undefined}>{opt.label}</Text>
        </Box>
      ))}
    </Box>
  )
}
