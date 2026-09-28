try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional (e.g. CI passes DATABASE_URL directly)
}

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
