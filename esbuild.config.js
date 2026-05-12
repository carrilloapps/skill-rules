import { build, context } from 'esbuild'

const watch = process.argv.includes('--watch')

const config = {
  entryPoints: ['src/index.jsx'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile: 'dist/index.js',
  banner: { js: '#!/usr/bin/env node' },
}

if (watch) {
  const ctx = await context(config)
  await ctx.watch()
  console.log('Watching for changes…')
} else {
  await build(config)
}
