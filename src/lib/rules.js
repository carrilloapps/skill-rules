import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const RULES_FILE = 'skills.rules'

export function readRules(cwd = process.cwd()) {
  const rulesPath = join(cwd, RULES_FILE)
  if (!existsSync(rulesPath)) return null
  try {
    return JSON.parse(readFileSync(rulesPath, 'utf8'))
  } catch {
    throw new Error(`Failed to parse ${RULES_FILE}. Delete it and run: skill-rules init`)
  }
}

export function writeRules(rules, cwd = process.cwd()) {
  const rulesPath = join(cwd, RULES_FILE)
  writeFileSync(rulesPath, JSON.stringify(rules, null, 2) + '\n')
}

export function createEmptyRules() {
  return { version: 1, stages: {} }
}

// Returns the skill names active for a given stage.
// If no stage is given, returns the union of all stages.
export function getActiveSkills(rules, stage) {
  if (!rules) return []
  const { stages } = rules
  if (stage) {
    return stages[stage] ?? []
  }
  // Union across all stages, preserving insertion order
  const seen = new Set()
  for (const skills of Object.values(stages)) {
    for (const s of skills) seen.add(s)
  }
  return [...seen]
}

export function addSkillToStage(rules, skillName, stage) {
  if (!rules.stages[stage]) rules.stages[stage] = []
  if (!rules.stages[stage].includes(skillName)) {
    rules.stages[stage].push(skillName)
  }
  return rules
}

export function removeSkillFromStage(rules, skillName, stage) {
  if (stage) {
    rules.stages[stage] = (rules.stages[stage] ?? []).filter((s) => s !== skillName)
    if (rules.stages[stage].length === 0) delete rules.stages[stage]
  } else {
    for (const key of Object.keys(rules.stages)) {
      rules.stages[key] = rules.stages[key].filter((s) => s !== skillName)
      if (rules.stages[key].length === 0) delete rules.stages[key]
    }
  }
  return rules
}

export function listStages(rules) {
  return Object.keys(rules?.stages ?? {})
}
