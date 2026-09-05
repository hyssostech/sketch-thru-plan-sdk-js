import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.vitest.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        statements: 75,
        branches: 70,
        functions: 60,
        lines: 75,
      },
      exclude: [
        'src/geojson-rewind.ts',
        'src/stpc2simproxy.ts',
      ],
    },
  },
});
