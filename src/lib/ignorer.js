import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const MARKER_START = '# skill-rules [start]'
const MARKER_END = '# skill-rules [end]'

export function updateGitignore(cwd, patterns) {
  const gitignorePath = join(cwd, '.gitignore')
  let content = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : ''

  const escapedStart = escapeRegex(MARKER_START)
  const escapedEnd = escapeRegex(MARKER_END)
  content = content.replace(new RegExp(`\\n?${escapedStart}[\\s\\S]*?${escapedEnd}\\n?`, 'g'), '')

  if (patterns.length === 0) {
    writeFileSync(gitignorePath, content)
    return
  }

  const normalized = patterns.map((p) => p.replace(/\\/g, '/'))
  const section = `\n${MARKER_START}\n${normalized.join('\n')}\n${MARKER_END}\n`
  writeFileSync(gitignorePath, content.trimEnd() + section)
}

// Builds the gitignore pattern list for a set of IDEs, excluding tracked skills.
// Tracked skills get a negation rule so they are committed to git.
export function buildIgnorePatterns(ides, trackedSkillNames = []) {
  const patterns = ['.skill-rules/']
  for (const ide of ides) {
    patterns.push(ide.skillsDir)
    for (const skill of trackedSkillNames) {
      patterns.push(`!${ide.skillsDir}/${skill}`)
    }
  }
  return patterns
}

// Reads tracked skills from the lock file, builds patterns, and updates .gitignore.
export function syncGitignore(cwd, ides, lock) {
  const tracked = Object.entries(lock?.skills ?? {})
    .filter(([, info]) => info.track)
    .map(([name]) => name)
  updateGitignore(cwd, buildIgnorePatterns(ides, tracked))
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
