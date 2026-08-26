import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Two projects, split by file extension:
//   *.test.ts   pure logic and API routes, run in node (fast, no DOM cost)
//   *.test.tsx  components, run in jsdom with Testing Library
//
// Splitting matters: loading jsdom and the RTL setup for the route tests would
// slow every run for no benefit, and importing Testing Library in a node
// environment fails outright.
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { tsconfigPaths: true },
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['tests/**/*.test.tsx'],
          setupFiles: ['./tests/setup-dom.ts'],
        },
      },
    ],
  },
})
