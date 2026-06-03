import { defineConfig } from "drizzle-kit";
import { homedir } from "node:os";
import { join } from "node:path";

const deskHome = process.env.DESK_HOME ?? join(homedir(), "desk");

export default defineConfig({
  dialect: "sqlite",
  schema: "./model/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: join(deskHome, "desk.db"),
  },
});
