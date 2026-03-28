import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'

// @react-pdf/pdfkit imports pako subpaths but doesn't declare pako as a dependency.
// pnpm strict isolation prevents resolution, so we alias to the correct store path.
const pakoBase = path.resolve(
  __dirname,
  '../../node_modules/.pnpm/pako@0.2.9/node_modules/pako',
)

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'pako/lib/zlib/zstream.js': path.join(pakoBase, 'lib/zlib/zstream.js'),
      'pako/lib/zlib/deflate.js': path.join(pakoBase, 'lib/zlib/deflate.js'),
      'pako/lib/zlib/inflate.js': path.join(pakoBase, 'lib/zlib/inflate.js'),
      'pako': pakoBase,
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  build: {},
  server: {
    port: 5174,
    strictPort: true, // Fail instead of auto-incrementing to prevent port collision
  },
})
