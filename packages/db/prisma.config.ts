import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

import { withNeonConnectionDefaults } from "./src/connection-defaults";

loadEnv({ path: ".env" });

if (process.env.DATABASE_URL !== undefined) {
  process.env.DATABASE_URL = withNeonConnectionDefaults(process.env.DATABASE_URL);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
