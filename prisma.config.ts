import { config } from "dotenv"
import { defineConfig, env } from "prisma/config"

// Load .env.local so DATABASE_URL is available to all prisma CLI commands
config({ path: ".env.local" })

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file=.env.local prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
})
