import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    reporters: ['verbose'],
    exclude: [
      '**/node_modules/**',
      '**/.claude/worktrees/**'
    ],
    onConsoleLog(log, type) {
      if (type === 'stdout' && log.includes('SKIP')) {
        return false;
      }
    }
  }
});
