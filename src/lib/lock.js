import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const LOCK_FILE = 'skills-lock.json'

export function readLock(cwd = process.cwd()) {
  const lockPath = join(cwd, LOCK_FILE)
  if (!existsSync(lockPath)) {
    return { version: 1, skills: {} }
  }
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'))
  } catch {
    throw new Error(`Failed to parse ${LOCK_FILE}. Delete it and run: skill-rules init`)
  }
}

export function writeLock(lock, cwd = process.cwd()) {
  const lockPath = join(cwd, LOCK_FILE)
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
}

export function setSkillTracked(lock, skillName, tracked) {
  if (!lock.skills[skillName]) return lock
  if (tracked) {
    lock.skills[skillName].track = true
  } else {
    delete lock.skills[skillName].track
  }
  return lock
}
