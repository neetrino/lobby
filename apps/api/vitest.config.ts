import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2023',
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    fileParallelism: false,
    sequence: { concurrent: false },
    hookTimeout: 60_000,
    env: {
      OUTBOX_TEST_DATABASE_URL: 'postgresql://lobby:lobby@127.0.0.1:54329/lobby_outbox_api_test',
    },
  },
});
