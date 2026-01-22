import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  noExternal: ['@ella/db', '@ella/shared'],
  external: ['sharp', 'pdf-poppler'],
})
