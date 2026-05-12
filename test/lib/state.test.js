import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getActiveStage, setActiveStage, clearActiveStage } from '../../src/lib/state.js'

let tmp

beforeEach(() => {
  tmp = join(tmpdir(), `sr-test-state-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('getActiveStage', () => {
  it('returns null when no state file exists', () => {
    expect(getActiveStage(tmp)).toBeNull()
  })

  it('returns null when state file has no activeStage', () => {
    setActiveStage('dev', tmp)
    clearActiveStage(tmp)
    expect(getActiveStage(tmp)).toBeNull()
  })

  it('returns null when state file contains invalid JSON', () => {
    mkdirSync(join(tmp, '.skill-rules'), { recursive: true })
    writeFileSync(join(tmp, '.skill-rules', 'state.json'), 'not json')
    expect(getActiveStage(tmp)).toBeNull()
  })
})

describe('setActiveStage', () => {
  it('persists the active stage', () => {
    setActiveStage('qa', tmp)
    expect(getActiveStage(tmp)).toBe('qa')
  })

  it('overwrites a previously set stage', () => {
    setActiveStage('dev', tmp)
    setActiveStage('production', tmp)
    expect(getActiveStage(tmp)).toBe('production')
  })

  it('creates .skill-rules/ directory if it does not exist', () => {
    const nested = join(tmp, 'project')
    mkdirSync(nested)
    setActiveStage('dev', nested)
    expect(getActiveStage(nested)).toBe('dev')
  })
})

describe('clearActiveStage', () => {
  it('removes the active stage', () => {
    setActiveStage('dev', tmp)
    clearActiveStage(tmp)
    expect(getActiveStage(tmp)).toBeNull()
  })

  it('does not throw when state file does not exist', () => {
    expect(() => clearActiveStage(tmp)).not.toThrow()
  })
})
