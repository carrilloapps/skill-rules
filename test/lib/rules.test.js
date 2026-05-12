import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  readRules,
  writeRules,
  createEmptyRules,
  getActiveSkills,
  addSkillToStage,
  removeSkillFromStage,
  listStages,
} from '../../src/lib/rules.js'

let tmp

beforeEach(() => {
  tmp = join(tmpdir(), `sr-test-rules-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('readRules', () => {
  it('returns null when file does not exist', () => {
    expect(readRules(tmp)).toBeNull()
  })

  it('reads and parses a valid rules file', () => {
    const rules = { version: 1, stages: { dev: ['review'] } }
    writeFileSync(join(tmp, 'skills.rules'), JSON.stringify(rules))
    expect(readRules(tmp)).toEqual(rules)
  })

  it('throws on invalid JSON', () => {
    writeFileSync(join(tmp, 'skills.rules'), 'not json')
    expect(() => readRules(tmp)).toThrow('skills.rules')
  })
})

describe('writeRules', () => {
  it('writes rules as formatted JSON with trailing newline', () => {
    const rules = createEmptyRules()
    writeRules(rules, tmp)
    const raw = readRules(tmp)
    expect(raw).toEqual(rules)
  })
})

describe('createEmptyRules', () => {
  it('returns version 1 with empty stages', () => {
    expect(createEmptyRules()).toEqual({ version: 1, stages: {} })
  })
})

describe('getActiveSkills', () => {
  it('returns skills for a specific stage', () => {
    const rules = { version: 1, stages: { dev: ['a', 'b'], qa: ['b', 'c'] } }
    expect(getActiveSkills(rules, 'dev')).toEqual(['a', 'b'])
  })

  it('returns union of all stages when no stage given', () => {
    const rules = { version: 1, stages: { dev: ['a', 'b'], qa: ['b', 'c'] } }
    expect(getActiveSkills(rules, null)).toEqual(['a', 'b', 'c'])
  })

  it('returns empty array when stage does not exist', () => {
    const rules = { version: 1, stages: {} }
    expect(getActiveSkills(rules, 'dev')).toEqual([])
  })

  it('returns empty array when rules is null', () => {
    expect(getActiveSkills(null, null)).toEqual([])
  })
})

describe('addSkillToStage', () => {
  it('creates stage and adds skill', () => {
    const rules = createEmptyRules()
    addSkillToStage(rules, 'review', 'dev')
    expect(rules.stages.dev).toEqual(['review'])
  })

  it('does not add duplicate', () => {
    const rules = { version: 1, stages: { dev: ['review'] } }
    addSkillToStage(rules, 'review', 'dev')
    expect(rules.stages.dev).toEqual(['review'])
  })
})

describe('removeSkillFromStage', () => {
  it('removes skill from a specific stage', () => {
    const rules = { version: 1, stages: { dev: ['a', 'b'], qa: ['a'] } }
    removeSkillFromStage(rules, 'a', 'dev')
    expect(rules.stages.dev).toEqual(['b'])
    expect(rules.stages.qa).toEqual(['a'])
  })

  it('removes skill from all stages when no stage given', () => {
    const rules = { version: 1, stages: { dev: ['a', 'b'], qa: ['a'] } }
    removeSkillFromStage(rules, 'a', null)
    expect(rules.stages.dev).toEqual(['b'])
    expect(rules.stages.qa).toBeUndefined()
  })

  it('deletes stage when it becomes empty', () => {
    const rules = { version: 1, stages: { dev: ['only'] } }
    removeSkillFromStage(rules, 'only', 'dev')
    expect(rules.stages.dev).toBeUndefined()
  })

  it('handles removal from a stage that does not exist', () => {
    const rules = { version: 1, stages: {} }
    removeSkillFromStage(rules, 'ghost', 'dev')
    expect(rules.stages.dev).toBeUndefined()
  })
})

describe('listStages', () => {
  it('returns stage names', () => {
    const rules = { version: 1, stages: { dev: [], qa: [] } }
    expect(listStages(rules)).toEqual(['dev', 'qa'])
  })

  it('returns empty array for null rules', () => {
    expect(listStages(null)).toEqual([])
  })
})
