import { createCli } from './cli.jsx'

createCli()
  .parseAsync(process.argv)
  .catch((err) => {
    console.error(`\x1b[31mError:\x1b[0m ${err.message}`)
    process.exit(1)
  })
