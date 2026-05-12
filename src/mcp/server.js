import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { detectIDEs } from '../lib/ides.js'
import { readLock, writeLock, setSkillTracked } from '../lib/lock.js'
import {
  readRules,
  writeRules,
  createEmptyRules,
  addSkillToStage,
  removeSkillFromStage,
  getActiveSkills,
  listStages,
} from '../lib/rules.js'
import { syncGitignore } from '../lib/ignorer.js'
import { findSkillSources, syncSkillToMissingIDEs } from '../lib/syncer.js'
import { stashSkill, restoreSkill, isStashed, listStashed } from '../lib/stash.js'
import { getActiveStage, setActiveStage, clearActiveStage } from '../lib/state.js'

const TOOLS = [
  {
    name: 'sync',
    description:
      'Sync active skills across all detected IDEs. Copies skills from IDEs that have them to IDEs that are missing them.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          description: 'Stage to filter skills by. Defaults to the currently active stage.',
        },
      },
    },
  },
  {
    name: 'status',
    description:
      'Show current state: active stage, detected IDEs, installed skills with their stage assignments, and stash contents.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'init',
    description:
      'Initialize skill-rules in the project. Creates skills-lock.json and skills.rules if absent, and updates .gitignore.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'add',
    description: 'Assign a skill to a stage.',
    inputSchema: {
      type: 'object',
      properties: {
        skill: { type: 'string', description: 'Skill name to assign' },
        stage: { type: 'string', description: 'Stage name to assign the skill to' },
        track: {
          type: 'boolean',
          description: 'Commit this skill to git instead of gitignoring it (default: false)',
        },
      },
      required: ['skill', 'stage'],
    },
  },
  {
    name: 'remove',
    description: 'Remove a skill from a stage, or from all stages when no stage is given.',
    inputSchema: {
      type: 'object',
      properties: {
        skill: { type: 'string', description: 'Skill name to remove' },
        stage: {
          type: 'string',
          description: 'Stage to remove from. Omit to remove from all stages.',
        },
      },
      required: ['skill'],
    },
  },
  {
    name: 'use',
    description:
      'Activate a stage: stash skills not assigned to it, restore skills that are. Pass off: true to restore everything and clear the active stage.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string', description: 'Stage name to activate' },
        off: {
          type: 'boolean',
          description: 'Restore all stashed skills and clear the active stage',
        },
      },
    },
  },
  {
    name: 'list',
    description:
      'List all installed skills with their stage assignments, installation status, and git tracking. Use track/untrack to change tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        track: { type: 'string', description: 'Skill name to start committing to git' },
        untrack: { type: 'string', description: 'Skill name to exclude from git' },
      },
    },
  },
  {
    name: 'ignore',
    description: 'Regenerate the skill-rules block in .gitignore for all detected IDE directories.',
    inputSchema: { type: 'object', properties: {} },
  },
]

function ok(text) {
  return { content: [{ type: 'text', text }] }
}

function fail(text) {
  return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true }
}

function toolSync(cwd, args) {
  const stage = args.stage ?? getActiveStage(cwd)
  const ides = detectIDEs(cwd)
  if (ides.length === 0)
    return fail(
      'No IDE directories detected. Expected: .claude/ .cursor/ .windsurf/ .agents/ .openhands/ .opencode/'
    )

  const lock = readLock(cwd)
  const rules = readRules(cwd)

  if (stage && rules && !(stage in (rules.stages ?? {}))) {
    const available = listStages(rules)
    return fail(
      `Stage "${stage}" not found.${available.length ? ` Available: ${available.join(', ')}` : ' No stages defined yet.'}`
    )
  }

  syncGitignore(cwd, ides, lock)

  const skillsToCheck = stage ? getActiveSkills(rules, stage) : Object.keys(lock.skills)
  if (skillsToCheck.length === 0)
    return ok(
      `No skills${stage ? ` in stage [${stage}]` : ''} to sync.\nIDEs (${ides.length}): ${ides.map((i) => i.name).join(', ')}`
    )

  const lines = [
    `Sync${stage ? ` [${stage}]` : ''} — ${ides.length} IDE${ides.length !== 1 ? 's' : ''}`,
    '',
  ]
  for (const skillName of skillsToCheck) {
    const sources = findSkillSources(cwd, ides, skillName)
    if (sources.length === 0) {
      lines.push(`missing   ${skillName}`)
    } else if (sources.length < ides.length) {
      const copied = syncSkillToMissingIDEs(cwd, ides, skillName, sources[0])
      lines.push(
        `synced    ${skillName}  → ${copied} IDE${copied !== 1 ? 's' : ''} from ${sources[0].name}`
      )
    } else {
      lines.push(`ok        ${skillName}`)
    }
  }
  return ok(lines.join('\n'))
}

function toolStatus(cwd) {
  const ides = detectIDEs(cwd)
  const lock = readLock(cwd)
  const rules = readRules(cwd)
  const activeStage = getActiveStage(cwd)
  const stashed = listStashed(cwd)
  const stages = listStages(rules ?? { stages: {} })
  const skills = Object.entries(lock.skills)

  const lines = [
    `Active stage : ${activeStage ? `[${activeStage}]` : 'none'}`,
    `IDEs         : ${ides.length > 0 ? ides.map((i) => i.name).join(', ') : 'none detected'}`,
    `Stages       : ${stages.length > 0 ? stages.join(', ') : 'none'}`,
    `Stashed      : ${stashed.length > 0 ? stashed.join(', ') : 'none'}`,
    '',
  ]

  if (skills.length === 0) {
    lines.push('No skills installed yet.')
  } else {
    lines.push('Skills:')
    for (const [name, info] of skills) {
      const skillStages = stages.filter((s) => (rules?.stages[s] ?? []).includes(name))
      const stageStr = skillStages.length ? skillStages.join(', ') : '—'
      const tracking = info.track ? '  [git tracked]' : ''
      lines.push(`  ${name.padEnd(22)} ${stageStr}${tracking}`)
    }
  }

  return ok(lines.join('\n'))
}

function toolInit(cwd) {
  const ides = detectIDEs(cwd)
  const lines = []

  const lockPath = join(cwd, 'skills-lock.json')
  if (!existsSync(lockPath)) {
    writeFileSync(lockPath, JSON.stringify({ version: 1, skills: {} }, null, 2) + '\n')
    lines.push('created  skills-lock.json')
  } else {
    lines.push('exists   skills-lock.json')
  }

  const rulesPath = join(cwd, 'skills.rules')
  if (!existsSync(rulesPath)) {
    writeFileSync(rulesPath, JSON.stringify(createEmptyRules(), null, 2) + '\n')
    lines.push('created  skills.rules')
  } else {
    lines.push('exists   skills.rules')
  }

  if (ides.length > 0) {
    const lock = readLock(cwd)
    syncGitignore(cwd, ides, lock)
    lines.push('updated  .gitignore')
    lines.push(`IDEs     ${ides.map((i) => i.name).join(', ')}`)
  } else {
    lines.push(
      'warning  No IDE directories detected — .gitignore not updated\n         Create one of: .claude/ .cursor/ .windsurf/ .agents/ .openhands/ .opencode/'
    )
  }

  return ok(lines.join('\n'))
}

function toolAdd(cwd, args) {
  const { skill, stage, track = false } = args
  const lock = readLock(cwd)
  const ides = detectIDEs(cwd)
  const rules = readRules(cwd) ?? createEmptyRules()
  const inLock = !!lock.skills[skill]
  const alreadyInStage = (rules.stages[stage] ?? []).includes(skill)
  const isNewStage = !listStages(rules).includes(stage)

  if (!alreadyInStage) {
    addSkillToStage(rules, skill, stage)
    writeRules(rules, cwd)
  }
  if (track && inLock) {
    setSkillTracked(lock, skill, true)
    writeLock(lock, cwd)
  }
  if (ides.length > 0) syncGitignore(cwd, ides, lock)

  const lines = []
  if (!inLock)
    lines.push(
      `warning  "${skill}" not in skills-lock.json — install via skills.sh or autoskill first`
    )
  if (isNewStage && !alreadyInStage) lines.push(`created  stage [${stage}]`)
  lines.push(
    alreadyInStage
      ? `exists   "${skill}" already in [${stage}]`
      : `added    "${skill}" → [${stage}]`
  )
  if (track)
    lines.push(
      inLock ? 'tracked  git tracking enabled' : 'warning  git tracking skipped (not in lock)'
    )

  return ok(lines.join('\n'))
}

function toolRemove(cwd, args) {
  const { skill, stage } = args
  const rules = readRules(cwd)
  if (!rules) return fail('No skills.rules found. Run init first.')

  const stages = listStages(rules)
  const inAnyStage = stages.some((s) => (rules.stages[s] ?? []).includes(skill))
  if (!inAnyStage) return fail(`"${skill}" is not assigned to any stage.`)

  if (stage && !(rules.stages[stage] ?? []).includes(skill)) {
    const assignedTo = stages.filter((s) => (rules.stages[s] ?? []).includes(skill))
    return fail(`"${skill}" is not in [${stage}]. Assigned to: ${assignedTo.join(', ')}`)
  }

  removeSkillFromStage(rules, skill, stage ?? null)
  writeRules(rules, cwd)

  const lock = readLock(cwd)
  const ides = detectIDEs(cwd)
  if (ides.length > 0) syncGitignore(cwd, ides, lock)

  return ok(`removed  "${skill}" from ${stage ? `[${stage}]` : 'all stages'}`)
}

function toolUse(cwd, args) {
  const { stage, off } = args
  const ides = detectIDEs(cwd)
  const lock = readLock(cwd)

  if (!stage && !off) {
    const activeStage = getActiveStage(cwd)
    const stashed = listStashed(cwd)
    if (!activeStage)
      return ok(
        `No active stage — all skills available.\nStashed: ${stashed.length > 0 ? stashed.join(', ') : 'none'}`
      )
    return ok(
      `Active stage: [${activeStage}]\nStashed (${stashed.length}): ${stashed.join(', ') || 'none'}`
    )
  }

  if (off) {
    const stashed = listStashed(cwd)
    if (stashed.length === 0) {
      clearActiveStage(cwd)
      return ok('Nothing stashed — no active stage to clear.')
    }
    if (ides.length === 0)
      return fail('No IDE directories detected — cannot restore stashed skills.')
    for (const s of stashed) restoreSkill(cwd, ides, s)
    clearActiveStage(cwd)
    syncGitignore(cwd, ides, lock)
    return ok(
      `Restored all stashed skills:\n${stashed.map((s) => `  restored  ${s}`).join('\n')}\n\nNo active stage — all skills available.`
    )
  }

  if (ides.length === 0) return fail('No IDE directories detected.')

  const rules = readRules(cwd)
  if (!rules) return fail('No skills.rules found. Run init first.')

  const available = listStages(rules)
  if (!available.includes(stage))
    return fail(
      `Stage "${stage}" not found.${available.length ? ` Available: ${available.join(', ')}` : ' No stages defined yet.'}`
    )

  const currentStage = getActiveStage(cwd)
  if (currentStage === stage) return ok(`Stage [${stage}] is already active.`)

  const targetSkills = new Set(rules.stages[stage] ?? [])
  const allStagedSkills = new Set(getActiveSkills(rules, null))
  const trackedSkills = new Set(
    Object.entries(lock.skills ?? {})
      .filter(([, info]) => info.track)
      .map(([name]) => name)
  )

  const toActivate = [],
    toRestore = [],
    toMissing = [],
    toStash = [],
    toSkip = []

  for (const skill of allStagedSkills) {
    if (trackedSkills.has(skill)) {
      toSkip.push(skill)
      continue
    }
    if (targetSkills.has(skill)) {
      if (isStashed(cwd, skill)) toRestore.push(skill)
      else {
        const inIDEs = ides.some((ide) => existsSync(join(cwd, ide.skillsDir, skill)))
        if (inIDEs) toActivate.push(skill)
        else toMissing.push(skill)
      }
    } else if (!isStashed(cwd, skill)) {
      const inIDEs = ides.some((ide) => existsSync(join(cwd, ide.skillsDir, skill)))
      if (inIDEs) toStash.push(skill)
    }
  }

  for (const skill of toStash) stashSkill(cwd, ides, skill)
  for (const skill of toRestore) restoreSkill(cwd, ides, skill)
  setActiveStage(stage, cwd)
  syncGitignore(cwd, ides, lock)

  const lines = [`Active stage: [${stage}]`, '']
  if (toActivate.length) lines.push(...toActivate.map((s) => `keep      ${s}`))
  if (toRestore.length) lines.push(...toRestore.map((s) => `restored  ${s}`))
  if (toStash.length) lines.push(...toStash.map((s) => `stashed   ${s}`))
  if (toMissing.length) lines.push(...toMissing.map((s) => `missing   ${s}  (not installed)`))
  if (toSkip.length) lines.push(...toSkip.map((s) => `skip      ${s}  (tracked in git)`))

  return ok(lines.join('\n'))
}

function toolList(cwd, args) {
  const { track, untrack } = args
  const lock = readLock(cwd)
  const ides = detectIDEs(cwd)

  if (track || untrack) {
    const skillName = track ?? untrack
    if (!lock.skills[skillName]) return fail(`"${skillName}" not found in skills-lock.json`)
    setSkillTracked(lock, skillName, !!track)
    writeLock(lock, cwd)
    syncGitignore(cwd, ides, lock)
    return ok(
      `${track ? 'tracked' : 'untracked'}  "${skillName}" — ${track ? 'will be committed to git' : 'excluded from git'}`
    )
  }

  const rules = readRules(cwd)
  const stages = listStages(rules ?? { stages: {} })
  const skills = Object.entries(lock.skills)

  if (skills.length === 0) return ok('No skills installed yet. Run: sr add')

  const header = `${'SKILL'.padEnd(22)} ${'STAGES'.padEnd(18)} INSTALLED    TRACKING`
  const lines = [header, '']
  for (const [name, info] of skills) {
    const sources = findSkillSources(cwd, ides, name)
    const skillStages = stages.filter((s) => (rules?.stages[s] ?? []).includes(name))
    const installed =
      sources.length === 0 ? 'missing' : sources.length === ides.length ? 'all IDEs' : 'partial'
    const tracking = info.track ? 'git' : 'ignored'
    lines.push(
      `${name.padEnd(22)} ${(skillStages.join(', ') || '—').padEnd(18)} ${installed.padEnd(13)}${tracking}`
    )
  }

  return ok(lines.join('\n'))
}

function toolIgnore(cwd) {
  const ides = detectIDEs(cwd)
  if (ides.length === 0) return fail('No IDE directories detected. Nothing to ignore.')
  const lock = readLock(cwd)
  syncGitignore(cwd, ides, lock)
  return ok(
    `.gitignore updated for ${ides.length} IDE${ides.length !== 1 ? 's' : ''}: ${ides.map((i) => i.name).join(', ')}`
  )
}

export async function startMcpServer() {
  const cwd = process.cwd()

  const server = new Server(
    { name: 'skill-rules', version: '0.2.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params
    try {
      switch (name) {
        case 'sync':
          return toolSync(cwd, args)
        case 'status':
          return toolStatus(cwd)
        case 'init':
          return toolInit(cwd)
        case 'add':
          return toolAdd(cwd, args)
        case 'remove':
          return toolRemove(cwd, args)
        case 'use':
          return toolUse(cwd, args)
        case 'list':
          return toolList(cwd, args)
        case 'ignore':
          return toolIgnore(cwd)
        default:
          return fail(`Unknown tool: ${name}`)
      }
    } catch (e) {
      return fail(e.message)
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
