import { Command } from 'commander'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { run } from './commands/run.jsx'
import { init } from './commands/init.jsx'
import { add } from './commands/add.jsx'
import { list } from './commands/list.jsx'
import { ignore } from './commands/ignore.jsx'
import { help } from './commands/help.jsx'
import { remove } from './commands/remove.jsx'
import { use } from './commands/use.jsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'))

const stageOption = ['-s, --stage <stage>', 'limit to a specific stage (e.g. dev, qa)']

export function createCli() {
  const program = new Command()

  program
    .name('skill-rules')
    .description('Sync AI agent skills across IDEs and manage per-stage skill rules')
    .version(version)
    .enablePositionalOptions()
    .addHelpCommand(false)
    .option(...stageOption)
    .action((options) => run(options))

  program
    .command('init')
    .description('Create skills-lock.json, skills.rules, and update .gitignore')
    .action(init)

  program
    .command('add [skill]')
    .description('Assign skills to stages — interactive when called with no arguments')
    .option(...stageOption)
    .option('--track', 'mark skill as tracked in git (default: gitignored)')
    .action(add)

  program
    .command('remove [skill]')
    .description('Remove skills from stages — interactive when called with no arguments')
    .option(...stageOption)
    .action(remove)

  program
    .command('list')
    .description('Show and manage skills — track/untrack from git interactively')
    .option('--track <skill>', 'commit a skill to git (remove from .gitignore)')
    .option('--untrack <skill>', 'exclude a skill from git (back to .gitignore)')
    .action(list)

  program
    .command('ignore')
    .description('Regenerate .gitignore for detected IDE skill directories')
    .action(ignore)

  program
    .command('use [stage]')
    .description('Activate a stage — stashes skills not in it, restores those that are')
    .option('--off', 'restore all stashed skills and clear the active stage')
    .action(use)

  program
    .command('help')
    .description('Show help for all commands')
    .action(help)

  return program
}
