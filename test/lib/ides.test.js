import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { detectIDEs, IDES } from '../../src/lib/ides.js'

let tmp

beforeEach(() => {
  tmp = join(tmpdir(), `sr-test-ides-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('IDES', () => {
  it('defines the expected IDE keys', () => {
    expect(Object.keys(IDES)).toEqual(
      expect.arrayContaining(['claude', 'cursor', 'windsurf', 'openhands', 'agents'])
    )
  })

  it('each IDE has name, detectDir, and skillsDir', () => {
    for (const ide of Object.values(IDES)) {
      expect(ide.name).toBeTruthy()
      expect(ide.detectDir).toBeTruthy()
      expect(ide.skillsDir).toBeTruthy()
    }
  })
})

describe('detectIDEs', () => {
  it('returns empty array when no IDE directories exist', () => {
    expect(detectIDEs(tmp)).toEqual([])
  })

  it('detects a single IDE directory', () => {
    mkdirSync(join(tmp, '.claude'))
    const found = detectIDEs(tmp)
    expect(found).toHaveLength(1)
    expect(found[0].id).toBe('claude')
  })

  it('detects multiple IDE directories', () => {
    mkdirSync(join(tmp, '.claude'))
    mkdirSync(join(tmp, '.cursor'))
    mkdirSync(join(tmp, '.windsurf'))
    const found = detectIDEs(tmp)
    expect(found).toHaveLength(3)
    expect(found.map((i) => i.id)).toEqual(
      expect.arrayContaining(['claude', 'cursor', 'windsurf'])
    )
  })

  it('includes id field in each result', () => {
    mkdirSync(join(tmp, '.agents'))
    const found = detectIDEs(tmp)
    expect(found[0].id).toBe('agents')
  })
})
