import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const STATE_DIR = '.skill-rules'
const STATE_FILE = 'state.json'

function statePath(cwd) {
  return join(cwd, STATE_DIR, STATE_FILE)
}

function readState(cwd) {
  const p = statePath(cwd)
  if (!existsSync(p)) return {}
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}

function writeState(state, cwd) {
  mkdirSync(join(cwd, STATE_DIR), { recursive: true })
  writeFileSync(statePath(cwd), JSON.stringify(state, null, 2) + '\n')
}

export function getActiveStage(cwd = process.cwd()) {
  return readState(cwd).activeStage ?? null
}

export function setActiveStage(stage, cwd = process.cwd()) {
  const state = readState(cwd)
  state.activeStage = stage
  writeState(state, cwd)
}

export function clearActiveStage(cwd = process.cwd()) {
  const state = readState(cwd)
  delete state.activeStage
  writeState(state, cwd)
}
