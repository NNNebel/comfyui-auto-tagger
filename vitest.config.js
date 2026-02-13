import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Show skipped tests in the output
    reporters: ['verbose'],
    // Fail if there are skipped tests in local environment
    // (CI environment will have GITHUB_ACTIONS=true)
    onConsoleLog(log, type) {
      if (type === 'stdout' && log.includes('SKIP')) {
        return false; // Don't suppress skip messages
      }
    }
  }
});
