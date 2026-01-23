import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  skipNodeModulesBundle: true,
  noExternal: ['@ella/shared'],
  // Native modules and Prisma must stay external
  external: [
    'sharp',
    '@prisma/client',
    'prisma',
    '@ella/db', // Contains Prisma generated code with CommonJS requires
  ],
})
