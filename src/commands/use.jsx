import React, { useState, useEffect } from 'react'
import { render, Box, Text, useApp } from 'ink'
import { existsSync } from 'fs'
import { join } from 'path'
import { detectIDEs } from '../lib/ides.js'
import { readLock } from '../lib/lock.js'
import { readRules, getActiveSkills, listStages } from '../lib/rules.js'
import { syncGitignore } from '../lib/ignorer.js'
import { getActiveStage, setActiveStage, clearActiveStage } from '../lib/state.js'
import { isStashed, listStashed, stashSkill, restoreSkill } from '../lib/stash.js'
import { Header, StatusLine, Hint, ListSelect } from '../ui.jsx'

export async function use(stage, options = {}) {
  const cwd = process.cwd()
  const { waitUntilExit } = render(
    <UseWizard cwd={cwd} stage={stage ?? null} off={options.off ?? false} />
  )
  await waitUntilExit()
}

function buildPlan(cwd, stage, ides, lock, rules) {
  const targetSkills = new Set(rules.stages[stage] ?? [])
  const allStagedSkills = new Set(getActiveSkills(rules, null))
  const trackedSkills = new Set(
    Object.entries(lock.skills ?? {})
      .filter(([, info]) => info.track)
      .map(([name]) => name)
  )

  const toActivate = []
  const toRestore = []
  const toMissing = []
  const toStash = []
  const toSkip = []

  for (const skill of allStagedSkills) {
    if (trackedSkills.has(skill)) {
      toSkip.push(skill)
      continue
    }
    if (targetSkills.has(skill)) {
      if (isStashed(cwd, skill)) {
        toRestore.push(skill)
      } else {
        const inIDEs = ides.some((ide) => existsSync(join(cwd, ide.skillsDir, skill)))
        if (inIDEs) toActivate.push(skill)
        else toMissing.push(skill)
      }
    } else {
      if (!isStashed(cwd, skill)) {
        const inIDEs = ides.some((ide) => existsSync(join(cwd, ide.skillsDir, skill)))
        if (inIDEs) toStash.push(skill)
      }
    }
  }

  return { toActivate, toRestore, toMissing, toStash, toSkip }
}

function executePlan(cwd, stage, ides, lock, plan) {
  for (const skill of plan.toStash) stashSkill(cwd, ides, skill)
  for (const skill of plan.toRestore) restoreSkill(cwd, ides, skill)
  setActiveStage(stage, cwd)
  syncGitignore(cwd, ides, lock)
}

function UseWizard({ cwd, stage, off }) {
  const { exit } = useApp()
  const [step, setStep] = useState('init')
  const [data, setData] = useState(null)

  useEffect(() => {
    const ides = detectIDEs(cwd)
    const lock = readLock(cwd)
    const currentStage = getActiveStage(cwd)

    // Status mode — no args
    if (!stage && !off) {
      const stashed = listStashed(cwd)
      const rules = readRules(cwd)
      setData({ mode: 'status', currentStage, stashed, rules })
      setStep('done')
      return
    }

    // Off mode — restore everything, no confirmation needed
    if (off) {
      const stashed = listStashed(cwd)
      if (stashed.length === 0) {
        clearActiveStage(cwd)
        setData({ mode: 'off', stashed: [] })
        setStep('done')
        return
      }
      if (ides.length === 0) {
        setData({
          mode: 'error',
          error: 'No IDE directories detected — cannot restore stashed skills.',
        })
        setStep('done')
        return
      }
      try {
        for (const skill of stashed) restoreSkill(cwd, ides, skill)
        clearActiveStage(cwd)
        syncGitignore(cwd, ides, lock)
        setData({ mode: 'off', stashed })
      } catch (err) {
        setData({ mode: 'error', error: err.message })
      }
      setStep('done')
      return
    }

    // Use <stage> mode
    if (ides.length === 0) {
      setData({
        mode: 'error',
        error:
          'No IDE directories detected.\nExpected: .claude/  .cursor/  .windsurf/  .agents/  .openhands/',
      })
      setStep('done')
      return
    }

    const rules = readRules(cwd)
    if (!rules) {
      setData({ mode: 'error', error: 'No skills.rules found. Run: skill-rules init' })
      setStep('done')
      return
    }

    const available = listStages(rules)
    if (!available.includes(stage)) {
      setData({
        mode: 'error',
        error: `Stage "${stage}" not found.${available.length ? `\nAvailable: ${available.join(', ')}` : '\nNo stages defined yet.'}`,
      })
      setStep('done')
      return
    }

    if (currentStage === stage) {
      setData({ mode: 'already', stage })
      setStep('done')
      return
    }

    const plan = buildPlan(cwd, stage, ides, lock, rules)

    // Happy path: nothing to stash — execute immediately, no confirmation
    if (plan.toStash.length === 0) {
      try {
        executePlan(cwd, stage, ides, lock, plan)
        setData({ mode: 'use', stage, plan })
      } catch (err) {
        setData({ mode: 'error', error: err.message })
      }
      setStep('done')
      return
    }

    // Has skills to stash — needs confirmation
    setData({ mode: 'use', stage, plan, ides, lock })
    setStep('confirm')
  }, [])

  useEffect(() => {
    if (step === 'done') exit()
  }, [step])

  if (step === 'confirm' && data) {
    const { plan, stage: targetStage, ides: ideList, lock: lockData } = data
    return (
      <Box flexDirection="column" gap={1}>
        <Header>skill-rules use {targetStage}</Header>
        <PlanPreview plan={plan} />
        <Text dimColor>Skills marked "stash" will be removed from IDEs and saved locally.</Text>
        <ListSelect
          options={[
            { label: 'Yes, activate stage', value: 'yes' },
            { label: 'Cancel', value: 'no' },
          ]}
          onSelect={(value) => {
            if (value === 'no') {
              exit()
              return
            }
            try {
              executePlan(cwd, targetStage, ideList, lockData, plan)
              setStep('done')
            } catch (err) {
              setData((d) => ({ ...d, mode: 'error', error: err.message }))
              setStep('done')
            }
          }}
        />
        <Hint>↑↓ navigate · Enter confirm</Hint>
      </Box>
    )
  }

  if (step === 'done' && data) {
    return <DoneView data={data} />
  }

  return null
}

function PlanPreview({ plan }) {
  const { toActivate, toRestore, toMissing, toStash, toSkip } = plan
  return (
    <Box flexDirection="column">
      {toActivate.map((s) => (
        <StatusLine key={s} variant="ok">
          {'keep    '} {s}
        </StatusLine>
      ))}
      {toRestore.map((s) => (
        <StatusLine key={s} variant="success">
          {'restore '} {s}
          <Text dimColor> (from stash)</Text>
        </StatusLine>
      ))}
      {toMissing.map((s) => (
        <StatusLine key={s} variant="warning">
          {'missing '} {s}
          <Text dimColor> (not installed)</Text>
        </StatusLine>
      ))}
      {toStash.map((s) => (
        <StatusLine key={s} variant="warning">
          {'stash   '} {s}
        </StatusLine>
      ))}
      {toSkip.map((s) => (
        <StatusLine key={s} variant="info">
          {'skip    '} {s}
          <Text dimColor> (tracked in git)</Text>
        </StatusLine>
      ))}
    </Box>
  )
}

function DoneView({ data }) {
  const { mode } = data

  if (mode === 'error') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="red">{data.error}</Text>
      </Box>
    )
  }

  if (mode === 'already') {
    return <StatusLine variant="info">Stage [{data.stage}] is already active.</StatusLine>
  }

  if (mode === 'off') {
    const { stashed } = data
    if (stashed.length === 0) {
      return <StatusLine variant="info">Nothing stashed — no active stage to clear.</StatusLine>
    }
    return (
      <Box flexDirection="column" gap={1}>
        <Header>Done</Header>
        {stashed.map((s) => (
          <StatusLine key={s} variant="success">
            restored {s}
          </StatusLine>
        ))}
        <Text dimColor>No active stage — all skills available.</Text>
      </Box>
    )
  }

  if (mode === 'status') {
    const { currentStage, stashed, rules } = data
    const stages = listStages(rules ?? { stages: {} })
    if (!currentStage) {
      return (
        <Box flexDirection="column" gap={1}>
          <StatusLine variant="info">No active stage — all skills available.</StatusLine>
          {stages.length > 0 && (
            <Text dimColor>Run: skill-rules use {'<stage>'} to activate one</Text>
          )}
        </Box>
      )
    }
    return (
      <Box flexDirection="column" gap={1}>
        <Header>skill-rules use</Header>
        <StatusLine variant="success">Active stage: [{currentStage}]</StatusLine>
        {stashed.length > 0 && (
          <Text dimColor>
            Stashed ({stashed.length}): {stashed.join(', ')}
          </Text>
        )}
        <Text dimColor>Run: skill-rules use --off to restore all</Text>
      </Box>
    )
  }

  if (mode === 'use') {
    const { plan, stage } = data
    const { toActivate, toRestore, toMissing, toStash, toSkip } = plan
    return (
      <Box flexDirection="column" gap={1}>
        <Header>Done</Header>
        {toActivate.map((s) => (
          <StatusLine key={s} variant="ok">
            active {s}
          </StatusLine>
        ))}
        {toRestore.map((s) => (
          <StatusLine key={s} variant="success">
            restored {s}
          </StatusLine>
        ))}
        {toStash.map((s) => (
          <StatusLine key={s} variant="warning">
            stashed {s}
          </StatusLine>
        ))}
        {toMissing.map((s) => (
          <StatusLine key={s} variant="warning">
            missing {s}
            <Text dimColor> — install via skills.sh or autoskill</Text>
          </StatusLine>
        ))}
        {toSkip.map((s) => (
          <StatusLine key={s} variant="info">
            tracked {s}
          </StatusLine>
        ))}
        <Text dimColor>Active stage: [{stage}] · Run skill-rules to sync IDEs</Text>
      </Box>
    )
  }

  return null
}
