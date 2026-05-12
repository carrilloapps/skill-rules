import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { isStashed, listStashed, stashSkill, restoreSkill } from '../../src/lib/stash.js'

let tmp

beforeEach(() => {
  tmp = join(tmpdir(), `sr-test-stash-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function makeSkill(base, skillsDir, name, content = 'skill') {
  const dir = join(base, skillsDir, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), content)
  return dir
}

const ides = [{ skillsDir: '.claude/skills' }, { skillsDir: '.cursor/skills' }]

describe('isStashed', () => {
  it('returns false when skill is not stashed', () => {
    expect(isStashed(tmp, 'review')).toBe(false)
  })

  it('returns true after a skill is stashed', () => {
    makeSkill(tmp, '.claude/skills', 'review')
    stashSkill(tmp, ides, 'review')
    expect(isStashed(tmp, 'review')).toBe(true)
  })
})

describe('listStashed', () => {
  it('returns empty array when stash does not exist', () => {
    expect(listStashed(tmp)).toEqual([])
  })

  it('lists stashed skill names', () => {
    makeSkill(tmp, '.claude/skills', 'review')
    stashSkill(tmp, ides, 'review')
    expect(listStashed(tmp)).toContain('review')
  })
})

describe('stashSkill', () => {
  it('removes skill from all IDE directories', () => {
    makeSkill(tmp, '.claude/skills', 'debug')
    makeSkill(tmp, '.cursor/skills', 'debug')

    stashSkill(tmp, ides, 'debug')

    expect(existsSync(join(tmp, '.claude/skills/debug'))).toBe(false)
    expect(existsSync(join(tmp, '.cursor/skills/debug'))).toBe(false)
  })

  it('copies skill to stash before removing', () => {
    makeSkill(tmp, '.claude/skills', 'debug', 'original content')
    stashSkill(tmp, ides, 'debug')
    expect(existsSync(join(tmp, '.skill-rules/stash/debug/SKILL.md'))).toBe(true)
  })

  it('is idempotent — does not double-stash', () => {
    makeSkill(tmp, '.claude/skills', 'debug')
    stashSkill(tmp, ides, 'debug')
    stashSkill(tmp, ides, 'debug')
    expect(listStashed(tmp)).toEqual(['debug'])
  })

  it('does nothing when skill is not installed in any IDE', () => {
    stashSkill(tmp, ides, 'ghost')
    expect(isStashed(tmp, 'ghost')).toBe(false)
  })
})

describe('restoreSkill', () => {
  it('restores skill to all IDE directories', () => {
    makeSkill(tmp, '.claude/skills', 'review')
    mkdirSync(join(tmp, '.cursor'), { recursive: true })
    stashSkill(tmp, ides, 'review')

    restoreSkill(tmp, ides, 'review')

    expect(existsSync(join(tmp, '.claude/skills/review'))).toBe(true)
    expect(existsSync(join(tmp, '.cursor/skills/review'))).toBe(true)
  })

  it('removes skill from stash after restoring', () => {
    makeSkill(tmp, '.claude/skills', 'review')
    stashSkill(tmp, ides, 'review')
    restoreSkill(tmp, ides, 'review')
    expect(isStashed(tmp, 'review')).toBe(false)
  })

  it('does nothing when skill is not in stash', () => {
    expect(() => restoreSkill(tmp, ides, 'ghost')).not.toThrow()
  })

  it('skips IDEs that already have the skill', () => {
    makeSkill(tmp, '.claude/skills', 'review', 'stash copy')
    stashSkill(tmp, ides, 'review')

    // pre-place the skill in cursor so restore skips it
    makeSkill(tmp, '.cursor/skills', 'review', 'existing')
    restoreSkill(tmp, ides, 'review')

    // skill is back in claude (restored) and cursor kept its existing copy
    expect(existsSync(join(tmp, '.claude/skills/review'))).toBe(true)
    expect(existsSync(join(tmp, '.cursor/skills/review'))).toBe(true)
  })
})
