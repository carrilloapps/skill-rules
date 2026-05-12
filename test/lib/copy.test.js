import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { copyDirSync } from '../../src/lib/copy.js'

let tmp

beforeEach(() => {
  tmp = join(tmpdir(), `sr-test-copy-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('copyDirSync', () => {
  it('copies a flat directory', () => {
    const src = join(tmp, 'src')
    const dest = join(tmp, 'dest')
    mkdirSync(src)
    writeFileSync(join(src, 'a.txt'), 'hello')
    writeFileSync(join(src, 'b.txt'), 'world')

    copyDirSync(src, dest)

    expect(readFileSync(join(dest, 'a.txt'), 'utf8')).toBe('hello')
    expect(readFileSync(join(dest, 'b.txt'), 'utf8')).toBe('world')
  })

  it('copies nested directories recursively', () => {
    const src = join(tmp, 'src')
    mkdirSync(join(src, 'nested'), { recursive: true })
    writeFileSync(join(src, 'nested', 'deep.txt'), 'deep')

    copyDirSync(src, join(tmp, 'dest'))

    expect(readFileSync(join(tmp, 'dest', 'nested', 'deep.txt'), 'utf8')).toBe('deep')
  })

  it('creates destination directory if it does not exist', () => {
    const src = join(tmp, 'src')
    const dest = join(tmp, 'new', 'deep', 'dest')
    mkdirSync(src)
    writeFileSync(join(src, 'x.txt'), 'x')

    copyDirSync(src, dest)

    expect(existsSync(dest)).toBe(true)
    expect(readFileSync(join(dest, 'x.txt'), 'utf8')).toBe('x')
  })
})
