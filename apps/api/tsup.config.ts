import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'], // CommonJS to support Prisma's require() calls
  outExtension: () => ({ js: '.cjs' }),
  dts: true,
  clean: true,
  skipNodeModulesBundle: true,
  noExternal: ['@ella/db', '@ella/shared'], // Bundle workspace packages
  // Native modules must stay external
  external: [
    'sharp',
    '@prisma/client',
    'prisma',
  ],
})
