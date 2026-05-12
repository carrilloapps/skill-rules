import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { copyDirSync } from './copy.js'

export function findSkillSources(cwd, ides, skillName) {
  return ides.filter((ide) => {
    const p = join(cwd, ide.skillsDir, skillName)
    return existsSync(p) && statSync(p).isDirectory()
  })
}

export function syncSkillToMissingIDEs(cwd, ides, skillName, sourceIde) {
  const sourcePath = join(cwd, sourceIde.skillsDir, skillName)
  let copied = 0

  for (const ide of ides) {
    const targetPath = join(cwd, ide.skillsDir, skillName)
    if (!existsSync(targetPath) || !statSync(targetPath).isDirectory()) {
      try {
        copyDirSync(sourcePath, targetPath)
        copied++
      } catch (err) {
        throw new Error(`Could not sync "${skillName}" to ${ide.name}: ${err.message}`, {
          cause: err,
        })
      }
    }
  }

  return copied
}
