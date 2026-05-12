import React, { useState, useEffect } from 'react'
import { render, Box, Text, useApp } from 'ink'
import { MultiSelect } from '@inkjs/ui'
import { detectIDEs } from '../lib/ides.js'
import { readLock } from '../lib/lock.js'
import { readRules, writeRules, removeSkillFromStage, listStages } from '../lib/rules.js'
import { syncGitignore } from '../lib/ignorer.js'
import { Header, StatusLine, Hint, ListSelect } from '../ui.jsx'

const ALL_STAGES = '__all__'

export async function remove(skill, options = {}) {
  const cwd = process.cwd()
  const stage = options.stage ?? null

  if (skill) {
    runNonInteractive(cwd, skill, stage)
  } else {
    const { waitUntilExit } = render(<RemoveWizard cwd={cwd} />)
    await waitUntilExit()
  }
}

function runNonInteractive(cwd, skillName, stage) {
  const rules = readRules(cwd)

  if (!rules) {
    const { unmount } = render(
      <StatusLine variant="warning">No skills.rules found. Nothing to remove.</StatusLine>
    )
    unmount()
    return
  }

  const stages = listStages(rules)
  const inAnyStage = stages.some(s => (rules.stages[s] ?? []).includes(skillName))
  if (!inAnyStage) {
    const { unmount } = render(
      <StatusLine variant="warning">"{skillName}" is not assigned to any stage.</StatusLine>
    )
    unmount()
    return
  }

  if (stage && !(rules.stages[stage] ?? []).includes(skillName)) {
    const assignedTo = stages.filter(s => (rules.stages[s] ?? []).includes(skillName))
    const { unmount } = render(
      <StatusLine variant="warning">
        "{skillName}" is not in [{stage}]. Assigned to: {assignedTo.join(', ')}
      </StatusLine>
    )
    unmount()
    return
  }

  removeSkillFromStage(rules, skillName, stage ?? null)
  writeRules(rules, cwd)

  const lock = readLock(cwd)
  const ides = detectIDEs(cwd)
  if (ides.length > 0) syncGitignore(cwd, ides, lock)

  const { unmount } = render(
    <Box flexDirection="column" gap={1}>
      <Header>skill-rules remove {skillName}</Header>
      <StatusLine variant="success">
        Removed from {stage ? `[${stage}]` : 'all stages'}
      </StatusLine>
      {ides.length > 0 && <StatusLine variant="success">.gitignore — updated</StatusLine>}
    </Box>
  )
  unmount()
}

function RemoveWizard({ cwd }) {
  const { exit } = useApp()
  const [step, setStep] = useState('select-skills')
  const [selectedSkills, setSelectedSkills] = useState([])
  const [summary, setSummary] = useState(null)

  const lock = readLock(cwd)
  const ides = detectIDEs(cwd)
  const rules = readRules(cwd) ?? { version: 1, stages: {} }
  const stages = listStages(rules)

  const stagedSkills = [...new Set(Object.values(rules.stages).flat())]

  useEffect(() => {
    if (step === 'done') exit()
  }, [step])

  if (stagedSkills.length === 0) {
    setTimeout(exit, 0)
    return (
      <Box flexDirection="column" gap={1}>
        <StatusLine variant="warning">No skills are assigned to any stage.</StatusLine>
        <Text dimColor>Use skill-rules add to assign skills to stages first.</Text>
      </Box>
    )
  }

  if (step === 'select-skills') {
    const options = stagedSkills.map(name => {
      const skillStages = stages.filter(s => (rules.stages[s] ?? []).includes(name))
      return {
        label: `${name.padEnd(20)} ${skillStages.join(', ')}`,
        value: name,
      }
    })
    return (
      <Box flexDirection="column" gap={1}>
        <Header>Remove from stage</Header>
        <Box gap={4}>
          <Text dimColor>{'SKILL'.padEnd(20)}</Text>
          <Text dimColor>ASSIGNED STAGES</Text>
        </Box>
        <MultiSelect
          options={options}
          onSubmit={(values) => {
            if (values.length === 0) { exit(); return }
            setSelectedSkills(values)
            setStep('select-stage')
          }}
        />
        <Hint>Space toggle  ·  Enter confirm  ·  0 selected = cancel</Hint>
      </Box>
    )
  }

  if (step === 'select-stage') {
    const relevantStages = stages.filter(s =>
      selectedSkills.some(skill => (rules.stages[s] ?? []).includes(skill))
    )
    const stageOptions = [
      ...relevantStages.map(s => ({ label: s, value: s })),
      { label: 'All stages', value: ALL_STAGES },
    ]
    return (
      <Box flexDirection="column" gap={1}>
        <Header>Remove from which stage?</Header>
        <Text dimColor>Skills: <Text color="cyan">{selectedSkills.join(', ')}</Text></Text>
        <ListSelect
          options={stageOptions}
          onSelect={(value) => {
            const stage = value === ALL_STAGES ? null : value
            applyRemove(cwd, selectedSkills, stage, rules, lock, ides)
            setSummary({ skills: selectedSkills, stage: value })
            setStep('done')
          }}
        />
        <Hint>↑↓ navigate  ·  Enter confirm</Hint>
      </Box>
    )
  }

  if (step === 'done' && summary) {
    return (
      <Box flexDirection="column" gap={1}>
        <Header>Done</Header>
        {summary.skills.map(name => (
          <StatusLine key={name} variant="success">
            {name} removed from {summary.stage === ALL_STAGES ? 'all stages' : `[${summary.stage}]`}
          </StatusLine>
        ))}
        <Text dimColor>Run skill-rules list to manage git tracking.</Text>
      </Box>
    )
  }

  return null
}

function applyRemove(cwd, skillNames, stage, rules, lock, ides) {
  for (const name of skillNames) {
    removeSkillFromStage(rules, name, stage)
  }
  writeRules(rules, cwd)
  if (ides.length > 0) syncGitignore(cwd, ides, lock)
}
