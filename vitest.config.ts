import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      // Lazy view imports plus full DOM interactions can exceed 5s on shared CI.
      testTimeout: 15_000,
    },
  })
);
