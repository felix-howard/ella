import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'], // CommonJS to support Prisma's require() calls
  outExtension: () => ({ js: '.cjs' }),
  dts: true,
  clean: true,
  onSuccess: 'rm -rf dist/assets && mkdir -p dist && cp -R src/assets dist/assets && test -f dist/assets/agreements/independent-contractor-obamacare-2026-05-15.pdf',
  skipNodeModulesBundle: true,
  noExternal: ['@ella/db', '@ella/shared'], // Bundle workspace packages
  // Native modules must stay external
  external: [
    'sharp',
    '@prisma/client',
    'prisma',
    '@react-pdf/renderer',
    'react',
  ],
})
