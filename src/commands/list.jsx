import React, { useState, useEffect } from 'react'
import { render, Box, Text, useApp } from 'ink'
import { MultiSelect } from '@inkjs/ui'
import { detectIDEs } from '../lib/ides.js'
import { readLock, writeLock, setSkillTracked } from '../lib/lock.js'
import { readRules, listStages } from '../lib/rules.js'
import { syncGitignore } from '../lib/ignorer.js'
import { findSkillSources } from '../lib/syncer.js'
import { Hint, Header, StatusLine } from '../ui.jsx'

export async function list(options = {}) {
  const { waitUntilExit } = render(<ListUI track={options.track} untrack={options.untrack} />)
  await waitUntilExit()
}

function ListUI({ track, untrack }) {
  const { exit } = useApp()
  const cwd = process.cwd()
  const lock = readLock(cwd)
  const rules = readRules(cwd)
  const ides = detectIDEs(cwd)
  const skills = Object.entries(lock.skills)
  const stages = listStages(rules)

  // --track / --untrack: non-interactive mode
  if (track || untrack) {
    const skillName = track ?? untrack
    const exists = !!lock.skills[skillName]

    if (!exists) {
      setTimeout(exit, 0)
      return <Text color="red">"{skillName}" not found in skills-lock.json</Text>
    }

    setSkillTracked(lock, skillName, !!track)
    writeLock(lock, cwd)
    syncGitignore(cwd, ides, lock)

    setTimeout(exit, 0)
    return (
      <StatusLine variant={track ? 'success' : 'warning'}>
        {track ? 'Tracking' : 'Ignoring'} {skillName}
        {track ? ' — will be committed to git' : ' — excluded from git'}
      </StatusLine>
    )
  }

  // Interactive mode
  if (skills.length === 0) {
    setTimeout(exit, 0)
    return <Text dimColor>No skills yet. Run: skill-rules add</Text>
  }

  return (
    <InteractiveList
      skills={skills}
      stages={stages}
      rules={rules}
      ides={ides}
      lock={lock}
      cwd={cwd}
    />
  )
}

function InteractiveList({ skills, stages, rules, ides, lock, cwd }) {
  const { exit } = useApp()
  const [done, setDone] = useState(false)
  const [updated, setUpdated] = useState([])

  const initialTracked = skills.filter(([, i]) => i.track).map(([n]) => n)

  const options = skills.map(([name, info]) => {
    const sources = findSkillSources(cwd, ides, name)
    const skillStages = stages.filter((s) => (rules?.stages[s] ?? []).includes(name))
    const installedLabel =
      sources.length === 0
        ? 'not installed'
        : sources.length === ides.length
          ? 'all IDEs'
          : sources.map((s) => s.name).join(', ')
    const stageLabel = skillStages.length > 0 ? skillStages.join(', ') : '—'
    return {
      label: `${name.padEnd(18)} ${stageLabel.padEnd(14)} ${installedLabel}`,
      value: name,
    }
  })

  const handleSubmit = (selected) => {
    const changed = []
    for (const [name] of skills) {
      const wasTracked = !!lock.skills[name].track
      const isNowTracked = selected.includes(name)
      if (wasTracked !== isNowTracked) {
        setSkillTracked(lock, name, isNowTracked)
        changed.push({ name, tracked: isNowTracked })
      }
    }
    writeLock(lock, cwd)
    syncGitignore(cwd, ides, lock)
    setUpdated(changed)
    setDone(true)
  }

  useEffect(() => {
    if (done) exit()
  }, [done])

  if (done) {
    if (updated.length === 0) return <Text dimColor>No changes.</Text>
    return (
      <Box flexDirection="column" gap={1}>
        <Header>Updated git tracking</Header>
        {updated.map(({ name, tracked }) => (
          <StatusLine key={name} variant={tracked ? 'success' : 'warning'}>
            {name} — {tracked ? 'now tracked (committed to git)' : 'now gitignored'}
          </StatusLine>
        ))}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Header>Skills</Header>
      <Box gap={4}>
        <Text dimColor>{'SKILL'.padEnd(18)}</Text>
        <Text dimColor>{'STAGES'.padEnd(14)}</Text>
        <Text dimColor>INSTALLED</Text>
      </Box>
      <Text dimColor>
        Select skills to <Text color="green">track in git</Text> (checked = committed, unchecked =
        gitignored)
      </Text>
      <MultiSelect options={options} defaultValue={initialTracked} onSubmit={handleSubmit} />
      <Hint>Space to toggle · Enter to confirm · tracked skills won't be in .gitignore</Hint>
    </Box>
  )
}
