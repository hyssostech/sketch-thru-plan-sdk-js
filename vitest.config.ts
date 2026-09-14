import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.vitest.ts'],
    coverage: {
      provider: 'v8',
      // 'lcov' is what SonarQube's JavaScript analyser imports; without it the
      // scanner reports 0.0% coverage no matter how much the suite actually
      // covers, which is exactly what the STP-740 baseline recorded.
      reporter: ['text', 'html', 'lcov'],
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
