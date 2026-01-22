import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  skipNodeModulesBundle: true,
  noExternal: ['@ella/db', '@ella/shared'],
})
