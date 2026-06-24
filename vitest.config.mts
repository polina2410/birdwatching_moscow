import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['app/**', 'lib/**', 'hooks/**', 'utils/**', 'context/**'],
      exclude: ['**/*.d.ts', '**/*.config.*', 'node_modules/**'],
    },
  },
})