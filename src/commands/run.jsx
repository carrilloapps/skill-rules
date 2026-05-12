import React, { useEffect, useState } from 'react'
import { render, Box, Text, useApp } from 'ink'
import { Spinner } from '@inkjs/ui'
import { detectIDEs } from '../lib/ides.js'
import { readLock } from '../lib/lock.js'
import { readRules, getActiveSkills, listStages } from '../lib/rules.js'
import { syncGitignore } from '../lib/ignorer.js'
import { findSkillSources, syncSkillToMissingIDEs } from '../lib/syncer.js'
import { getActiveStage } from '../lib/state.js'
import { Header, IDEItem, SkillStatus } from '../ui.jsx'

export async function run(options = {}) {
  const cwd = process.cwd()
  const explicitStage = options.stage ?? null
  const activeStage = getActiveStage(cwd)
  const stage = explicitStage ?? activeStage
  const { waitUntilExit } = render(<RunUI stage={stage} stageFromState={!explicitStage && !!activeStage} />)
  await waitUntilExit()
}

function RunUI({ stage, stageFromState }) {
  const { exit } = useApp()
  const [phase, setPhase] = useState('init')
  const [state, setState] = useState(null)

  useEffect(() => {
    try {
      const cwd = process.cwd()
      const ides = detectIDEs(cwd)
      const lock = readLock(cwd)
      const rules = readRules(cwd)

      if (ides.length === 0) {
        setState({ error: 'No IDE directories detected.\nExpected: .claude/  .cursor/  .windsurf/  .agents/  .openhands/' })
        setPhase('error')
        return
      }

      if (stage && rules && !(stage in (rules.stages ?? {}))) {
        const available = listStages(rules)
        const hint = stageFromState ? '\nActive stage is stale — run: skill-rules use --off' : ''
        setState({ error: `Stage "${stage}" not found.${available.length ? `\nAvailable: ${available.join(', ')}` : '\nNo stages defined yet.'}${hint}` })
        setPhase('error')
        return
      }

      syncGitignore(cwd, ides, lock)

      const activeSkills = getActiveSkills(rules, stage)
      const lockSkills = Object.keys(lock.skills)
      const skillsToCheck = stage ? activeSkills : lockSkills

      if (skillsToCheck.length === 0) {
        setState({ ides, results: [], stage })
        setPhase('done')
        return
      }

      const results = []
      for (const skillName of skillsToCheck) {
        const sources = findSkillSources(cwd, ides, skillName)
        if (sources.length === 0) {
          results.push({ name: skillName, status: 'missing' })
        } else if (sources.length < ides.length) {
          const copied = syncSkillToMissingIDEs(cwd, ides, skillName, sources[0])
          results.push({ name: skillName, status: 'synced', detail: `synced to ${copied} ${copied === 1 ? 'IDE' : 'IDEs'} from ${sources[0].name}` })
        } else {
          results.push({ name: skillName, status: 'ok' })
        }
      }

      setState({ ides, results, stage })
      setPhase('done')
    } catch (err) {
      setState({ error: err.message })
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    if (phase === 'done' || phase === 'error') exit()
  }, [phase])

  if (phase === 'init') return <Spinner label="Scanning IDEs and skills…" />

  if (phase === 'error') return (
    <Box flexDirection="column" gap={1}>
      <Text color="red">{state.error}</Text>
    </Box>
  )

  const { ides, results, stage: activeStage } = state

  if (!results || results.length === 0) {
    const msg = activeStage
      ? `Stage [${activeStage}] has no skills. Run: skill-rules add --stage ${activeStage}`
      : 'No skills yet. Run: skill-rules add'
    return <Text dimColor>{msg}</Text>
  }

  const ok = results.filter(r => r.status === 'ok')
  const synced = results.filter(r => r.status === 'synced')
  const missing = results.filter(r => r.status === 'missing')

  return (
    <Box flexDirection="column" gap={1}>
      <Header>skill-rules{activeStage ? ` [${activeStage}]` : ''}</Header>

      <Box flexDirection="column">
        <Text dimColor>IDEs ({ides.length})</Text>
        {ides.map(ide => <IDEItem key={ide.id} ide={ide} />)}
      </Box>

      <Box flexDirection="column">
        <Text dimColor>Skills ({results.length})</Text>
        {results.map(r => (
          <SkillStatus key={r.name} name={r.name} status={r.status} detail={r.detail} />
        ))}
      </Box>

      <Box gap={3}>
        {ok.length > 0 && <Text color="green">{ok.length} up to date</Text>}
        {synced.length > 0 && <Text color="yellow">{synced.length} synced</Text>}
        {missing.length > 0 && (
          <Text color="red">{missing.length} missing — install via <Text bold>skills.sh</Text> or <Text bold>autoskill</Text></Text>
        )}
      </Box>
    </Box>
  )
}
