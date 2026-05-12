import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { findSkillSources, syncSkillToMissingIDEs } from '../../src/lib/syncer.js'

let tmp

beforeEach(() => {
  tmp = join(tmpdir(), `sr-test-syncer-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const ides = [
  { id: 'claude', name: 'Claude Code', skillsDir: '.claude/skills' },
  { id: 'cursor', name: 'Cursor', skillsDir: '.cursor/skills' },
  { id: 'windsurf', name: 'Windsurf', skillsDir: '.windsurf/skills' },
]

function makeSkill(skillsDir, name) {
  const dir = join(tmp, skillsDir, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), `# ${name}`)
}

describe('findSkillSources', () => {
  it('returns IDEs that have the skill installed', () => {
    makeSkill('.claude/skills', 'review')
    const sources = findSkillSources(tmp, ides, 'review')
    expect(sources).toHaveLength(1)
    expect(sources[0].id).toBe('claude')
  })

  it('returns empty array when no IDE has the skill', () => {
    expect(findSkillSources(tmp, ides, 'missing')).toEqual([])
  })

  it('returns all IDEs that have the skill', () => {
    makeSkill('.claude/skills', 'review')
    makeSkill('.cursor/skills', 'review')
    const sources = findSkillSources(tmp, ides, 'review')
    expect(sources).toHaveLength(2)
  })
})

describe('syncSkillToMissingIDEs', () => {
  it('copies skill from source to IDEs that are missing it', () => {
    makeSkill('.claude/skills', 'review')

    const copied = syncSkillToMissingIDEs(tmp, ides, 'review', ides[0])

    expect(copied).toBe(2)
    expect(existsSync(join(tmp, '.cursor/skills/review/SKILL.md'))).toBe(true)
    expect(existsSync(join(tmp, '.windsurf/skills/review/SKILL.md'))).toBe(true)
  })

  it('skips IDEs that already have the skill', () => {
    makeSkill('.claude/skills', 'review')
    makeSkill('.cursor/skills', 'review')

    const copied = syncSkillToMissingIDEs(tmp, ides, 'review', ides[0])

    expect(copied).toBe(1)
    expect(existsSync(join(tmp, '.windsurf/skills/review/SKILL.md'))).toBe(true)
  })

  it('returns 0 when all IDEs already have the skill', () => {
    makeSkill('.claude/skills', 'review')
    makeSkill('.cursor/skills', 'review')
    makeSkill('.windsurf/skills', 'review')

    const copied = syncSkillToMissingIDEs(tmp, ides, 'review', ides[0])
    expect(copied).toBe(0)
  })

  it('throws when target path exists as a file instead of a directory', () => {
    makeSkill('.claude/skills', 'review')
    mkdirSync(join(tmp, '.cursor/skills'), { recursive: true })
    writeFileSync(join(tmp, '.cursor/skills/review'), 'not a dir')

    expect(() => syncSkillToMissingIDEs(tmp, ides, 'review', ides[0])).toThrow(
      'Could not sync "review" to Cursor'
    )
  })
})
