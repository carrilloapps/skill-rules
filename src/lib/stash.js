import { existsSync, statSync, readdirSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { copyDirSync } from './copy.js'

const STASH_DIR = '.skill-rules/stash'

function stashSkillPath(cwd, skillName) {
  return join(cwd, STASH_DIR, skillName)
}

export function isStashed(cwd, skillName) {
  const p = stashSkillPath(cwd, skillName)
  return existsSync(p) && statSync(p).isDirectory()
}

export function listStashed(cwd) {
  const stashDir = join(cwd, STASH_DIR)
  if (!existsSync(stashDir)) return []
  return readdirSync(stashDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
}

// Copies skill from first IDE that has it to stash, then removes from all IDEs
export function stashSkill(cwd, ides, skillName) {
  const dest = stashSkillPath(cwd, skillName)
  if (existsSync(dest)) return

  const source = ides.find((ide) => {
    const p = join(cwd, ide.skillsDir, skillName)
    return existsSync(p) && statSync(p).isDirectory()
  })

  if (source) {
    mkdirSync(join(cwd, STASH_DIR), { recursive: true })
    copyDirSync(join(cwd, source.skillsDir, skillName), dest)
  }

  for (const ide of ides) {
    const p = join(cwd, ide.skillsDir, skillName)
    if (existsSync(p)) rmSync(p, { recursive: true, force: true })
  }
}

// Copies skill from stash to all IDEs, then removes from stash
export function restoreSkill(cwd, ides, skillName) {
  const src = stashSkillPath(cwd, skillName)
  if (!existsSync(src)) return

  for (const ide of ides) {
    const ideSkillsDir = join(cwd, ide.skillsDir)
    const targetPath = join(ideSkillsDir, skillName)
    if (!existsSync(targetPath)) {
      mkdirSync(ideSkillsDir, { recursive: true })
      copyDirSync(src, targetPath)
    }
  }

  rmSync(src, { recursive: true, force: true })
}
