import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { buildIgnorePatterns, updateGitignore, syncGitignore } from '../../src/lib/ignorer.js'

let tmp

beforeEach(() => {
  tmp = join(tmpdir(), `sr-test-ignorer-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const fakeIdes = [{ skillsDir: '.claude/skills' }, { skillsDir: '.cursor/skills' }]

describe('buildIgnorePatterns', () => {
  it('includes .skill-rules/ first', () => {
    const patterns = buildIgnorePatterns(fakeIdes)
    expect(patterns[0]).toBe('.skill-rules/')
  })

  it('includes each IDE skills directory', () => {
    const patterns = buildIgnorePatterns(fakeIdes)
    expect(patterns).toContain('.claude/skills')
    expect(patterns).toContain('.cursor/skills')
  })

  it('adds negation rules for tracked skills', () => {
    const patterns = buildIgnorePatterns(fakeIdes, ['review'])
    expect(patterns).toContain('!.claude/skills/review')
    expect(patterns).toContain('!.cursor/skills/review')
  })

  it('returns only .skill-rules/ when IDE list is empty', () => {
    expect(buildIgnorePatterns([])).toEqual(['.skill-rules/'])
  })
})

describe('updateGitignore', () => {
  it('creates .gitignore with the skill-rules block', () => {
    updateGitignore(tmp, ['.skill-rules/', '.claude/skills'])
    const content = readFileSync(join(tmp, '.gitignore'), 'utf8')
    expect(content).toContain('# skill-rules [start]')
    expect(content).toContain('.claude/skills')
    expect(content).toContain('# skill-rules [end]')
  })

  it('replaces an existing block', () => {
    writeFileSync(
      join(tmp, '.gitignore'),
      'node_modules/\n# skill-rules [start]\n.old/skills\n# skill-rules [end]\n'
    )
    updateGitignore(tmp, ['.claude/skills'])
    const content = readFileSync(join(tmp, '.gitignore'), 'utf8')
    expect(content).toContain('node_modules/')
    expect(content).not.toContain('.old/skills')
    expect(content).toContain('.claude/skills')
  })

  it('removes the block when patterns is empty', () => {
    writeFileSync(
      join(tmp, '.gitignore'),
      '# skill-rules [start]\n.claude/skills\n# skill-rules [end]\n'
    )
    updateGitignore(tmp, [])
    const content = readFileSync(join(tmp, '.gitignore'), 'utf8')
    expect(content).not.toContain('# skill-rules')
  })

  it('normalises backslashes to forward slashes', () => {
    updateGitignore(tmp, ['.claude\\skills'])
    const content = readFileSync(join(tmp, '.gitignore'), 'utf8')
    expect(content).toContain('.claude/skills')
  })
})

describe('syncGitignore', () => {
  it('writes patterns derived from tracked skills in the lock', () => {
    const lock = { skills: { review: { track: true }, debug: {} } }
    syncGitignore(tmp, fakeIdes, lock)
    const content = readFileSync(join(tmp, '.gitignore'), 'utf8')
    expect(content).toContain('!.claude/skills/review')
    expect(content).not.toContain('!.claude/skills/debug')
  })

  it('handles a null lock gracefully', () => {
    expect(() => syncGitignore(tmp, fakeIdes, null)).not.toThrow()
  })
})
