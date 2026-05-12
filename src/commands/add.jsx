import React, { useState, useEffect } from 'react'
import { render, Box, Text, useApp } from 'ink'
import { MultiSelect, TextInput } from '@inkjs/ui'
import { detectIDEs } from '../lib/ides.js'
import { readLock, writeLock, setSkillTracked } from '../lib/lock.js'
import { readRules, writeRules, createEmptyRules, addSkillToStage, listStages } from '../lib/rules.js'
import { syncGitignore } from '../lib/ignorer.js'
import { Header, StatusLine, Hint, ListSelect } from '../ui.jsx'

const NEW_STAGE = '__new__'
const STAGE_RE = /^[a-z0-9_-]+$/

function normalizeSkillName(skill) {
  const base = skill.startsWith('@') ? skill.split('/')[1] : skill
  return base.replace(/^skill-/, '')
}

export async function add(skill, options = {}) {
  const cwd = process.cwd()
  const stage = options.stage ?? null
  const track = options.track ?? false

  if (stage) {
    if (!skill) {
      const { unmount } = render(
        <Text color="red">Usage: skill-rules add {'<skill>'} --stage {'<name>'}</Text>
      )
      unmount()
      return
    }
    runNonInteractive(cwd, normalizeSkillName(skill), stage, track)
  } else {
    const preselected = skill ? normalizeSkillName(skill) : null
    const { waitUntilExit } = render(<AddWizard cwd={cwd} preselected={preselected} />)
    await waitUntilExit()
  }
}

function runNonInteractive(cwd, skillName, stage, track) {
  const lock = readLock(cwd)
  const ides = detectIDEs(cwd)
  const inLock = !!lock.skills[skillName]
  const rules = readRules(cwd) ?? createEmptyRules()
  const existingStages = listStages(rules)
  const isNewStage = !existingStages.includes(stage)
  const alreadyInStage = (rules.stages[stage] ?? []).includes(skillName)

  if (!alreadyInStage) {
    addSkillToStage(rules, skillName, stage)
    writeRules(rules, cwd)
  }

  if (track && inLock) {
    setSkillTracked(lock, skillName, true)
    writeLock(lock, cwd)
  }

  if (ides.length > 0) syncGitignore(cwd, ides, lock)

  const { unmount } = render(
    <Box flexDirection="column" gap={1}>
      <Header>skill-rules add {skillName}</Header>
      <Box flexDirection="column">
        {!inLock && (
          <StatusLine variant="warning">
            {skillName} not in skills-lock.json — install via skills.sh or autoskill first
          </StatusLine>
        )}
        {isNewStage && !alreadyInStage && (
          <StatusLine variant="info">
            new stage [{stage}] created
          </StatusLine>
        )}
        <StatusLine variant={alreadyInStage ? 'info' : 'success'}>
          skills.rules [{stage}] — {alreadyInStage ? 'already present' : `added ${skillName}`}
        </StatusLine>
        {track && (
          <StatusLine variant={inLock ? 'success' : 'warning'}>
            git tracking — {inLock ? 'now tracked' : 'skipped (not in lock)'}
          </StatusLine>
        )}
        {ides.length > 0 && <StatusLine variant="success">.gitignore — updated</StatusLine>}
      </Box>
    </Box>
  )
  unmount()
}

function AddWizard({ cwd, preselected }) {
  const { exit } = useApp()
  const [step, setStep] = useState('select-skills')
  const [selectedSkills, setSelectedSkills] = useState([])
  const [stageName, setStageName] = useState('')
  const [stageError, setStageError] = useState('')
  const [summary, setSummary] = useState(null)

  const lock = readLock(cwd)
  const ides = detectIDEs(cwd)
  const skillNames = Object.keys(lock.skills)
  const rules = readRules(cwd) ?? createEmptyRules()
  const stages = listStages(rules)

  useEffect(() => {
    if (step === 'done') exit()
  }, [step])

  if (skillNames.length === 0) {
    setTimeout(exit, 0)
    return (
      <Box flexDirection="column" gap={1}>
        <StatusLine variant="warning">No skills installed yet.</StatusLine>
        <Text dimColor>Install via skills.sh or autoskill, then run skill-rules add.</Text>
      </Box>
    )
  }

  const preselectedMissing = preselected && !skillNames.includes(preselected)

  if (step === 'select-skills') {
    const options = skillNames.map(name => {
      const skillStages = stages.filter(s => (rules?.stages[s] ?? []).includes(name))
      return {
        label: `${name.padEnd(20)} ${skillStages.length ? skillStages.join(', ') : '—'}`,
        value: name,
      }
    })
    return (
      <Box flexDirection="column" gap={1}>
        <Header>Add skills to stage</Header>
        {preselectedMissing && (
          <StatusLine variant="warning">"{preselected}" not in skills-lock.json — install it first</StatusLine>
        )}
        <Box gap={4}>
          <Text dimColor>{'SKILL'.padEnd(20)}</Text>
          <Text dimColor>CURRENT STAGES</Text>
        </Box>
        <MultiSelect
          options={options}
          defaultValue={preselected && skillNames.includes(preselected) ? [preselected] : []}
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
    const stageOptions = [
      ...stages.map(s => ({ label: s, value: s })),
      { label: '+ Create new stage…', value: NEW_STAGE },
    ]
    return (
      <Box flexDirection="column" gap={1}>
        <Header>Select stage</Header>
        <Text dimColor>Skills: <Text color="cyan">{selectedSkills.join(', ')}</Text></Text>
        <ListSelect
          options={stageOptions}
          onSelect={(value) => {
            if (value === NEW_STAGE) {
              setStep('create-stage')
            } else {
              setStageName(value)
              setStep('confirm-track')
            }
          }}
        />
        <Hint>↑↓ navigate  ·  Enter confirm</Hint>
      </Box>
    )
  }

  if (step === 'create-stage') {
    return (
      <Box flexDirection="column" gap={1}>
        <Header>New stage name</Header>
        <Text dimColor>Allowed: letters, numbers, hyphens, underscores</Text>
        <TextInput
          placeholder="e.g. dev, qa, staging…"
          onSubmit={(value) => {
            const trimmed = value.trim().toLowerCase()
            if (!trimmed) return
            if (!STAGE_RE.test(trimmed)) {
              setStageError(`"${trimmed}" is invalid — use only letters, numbers, - and _`)
              return
            }
            setStageError('')
            setStageName(trimmed)
            setStep('confirm-track')
          }}
        />
        {stageError && <Text color="red">{stageError}</Text>}
      </Box>
    )
  }

  if (step === 'confirm-track') {
    return (
      <Box flexDirection="column" gap={1}>
        <Header>Git tracking</Header>
        <Text dimColor>Commit skills to git? By default each dev installs their own copy.</Text>
        <ListSelect
          options={[
            { label: 'No — keep gitignored  (recommended)', value: 'no' },
            { label: 'Yes — commit to repo', value: 'yes' },
          ]}
          onSelect={(value) => {
            const track = value === 'yes'
            applyChanges(cwd, selectedSkills, stageName, track, lock, rules, ides)
            setSummary({ skills: selectedSkills, stage: stageName, track })
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
            {name} → [{summary.stage}]{summary.track ? ' · tracked in git' : ''}
          </StatusLine>
        ))}
        <Text dimColor>Run npx skill-rules to sync across IDEs.</Text>
      </Box>
    )
  }

  return null
}

function applyChanges(cwd, skillNames, stage, track, lock, rules, ides) {
  for (const name of skillNames) {
    addSkillToStage(rules, name, stage)
    if (track && lock.skills[name] !== undefined) {
      setSkillTracked(lock, name, true)
    }
  }
  writeRules(rules, cwd)
  if (track) writeLock(lock, cwd)
  if (ides.length > 0) syncGitignore(cwd, ides, lock)
}
