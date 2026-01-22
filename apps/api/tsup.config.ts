import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  skipNodeModulesBundle: true,
  noExternal: ['@ella/db', '@ella/shared'],
  // Native modules must stay external for platform-specific binaries
  external: [
    'sharp',
    '@prisma/client',
    'prisma',
  ],
})
