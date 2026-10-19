import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const configRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: process.platform === 'win32' ? configRoot[0].toLowerCase() + configRoot.slice(1) : configRoot,
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'src/app/login/login.component.ts',
        'src/app/dashboard/dashboard.component.ts',
        'src/app/services/*.service.ts',
        'src/app/models/*.ts',
        'src/environments/*.ts'
      ],
      thresholds: {
        perFile: true,
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85
      }
    }
  }
});
