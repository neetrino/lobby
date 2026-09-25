import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    env: {
      OUTBOX_TEST_DATABASE_URL: 'postgresql://lobby:lobby@127.0.0.1:54329/lobby_outbox_api_test',
    },
  },
});
