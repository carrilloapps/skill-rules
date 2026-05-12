import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { readLock, writeLock, setSkillTracked } from '../../src/lib/lock.js'

let tmp

beforeEach(() => {
  tmp = join(tmpdir(), `sr-test-lock-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('readLock', () => {
  it('returns empty lock when file does not exist', () => {
    expect(readLock(tmp)).toEqual({ version: 1, skills: {} })
  })

  it('reads and parses a valid lock file', () => {
    const lock = { version: 1, skills: { review: {} } }
    writeFileSync(join(tmp, 'skills-lock.json'), JSON.stringify(lock))
    expect(readLock(tmp)).toEqual(lock)
  })

  it('throws on invalid JSON', () => {
    writeFileSync(join(tmp, 'skills-lock.json'), '{bad json')
    expect(() => readLock(tmp)).toThrow('skills-lock.json')
  })
})

describe('writeLock', () => {
  it('writes lock as formatted JSON with trailing newline', () => {
    const lock = { version: 1, skills: { debug: {} } }
    writeLock(lock, tmp)
    expect(readLock(tmp)).toEqual(lock)
  })
})

describe('setSkillTracked', () => {
  it('sets track: true on an existing skill', () => {
    const lock = { version: 1, skills: { review: {} } }
    setSkillTracked(lock, 'review', true)
    expect(lock.skills.review.track).toBe(true)
  })

  it('removes track when set to false', () => {
    const lock = { version: 1, skills: { review: { track: true } } }
    setSkillTracked(lock, 'review', false)
    expect(lock.skills.review.track).toBeUndefined()
  })

  it('does nothing when skill does not exist in lock', () => {
    const lock = { version: 1, skills: {} }
    setSkillTracked(lock, 'ghost', true)
    expect(lock.skills.ghost).toBeUndefined()
  })
})
