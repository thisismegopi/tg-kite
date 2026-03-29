import type { Config } from "drizzle-kit";

const dbFile = process.env.DB_FILE || "kite_bot.db";

export default {
    schema: "./src/db/schema.ts",
    out: "./src/db/migrations",
    dialect: "sqlite",
    dbCredentials: {
        url: dbFile,
    },
} satisfies Config;
