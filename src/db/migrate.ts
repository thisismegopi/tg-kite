import { sql } from "drizzle-orm";
import { getDb } from "./client";

export const DEFAULT_AI_CREDITS = 10;

export function ensureSchema(dbFile: string) {
    const { db } = getDb(dbFile);

    db.run(sql`
        CREATE TABLE IF NOT EXISTS sessions (
            telegram_user_id TEXT PRIMARY KEY,
            request_token TEXT,
            access_token TEXT,
            public_token TEXT,
            kite_user_id TEXT,
            user_name TEXT,
            avatar_url TEXT,
            login_time INTEGER,
            expires_at INTEGER
        )
    `);

    db.run(sql`
        CREATE TABLE IF NOT EXISTS ai_credits (
            telegram_user_id TEXT PRIMARY KEY,
            credits INTEGER DEFAULT ${DEFAULT_AI_CREDITS},
            total_used INTEGER DEFAULT 0,
            created_at INTEGER,
            updated_at INTEGER
        )
    `);

    db.run(sql`
        CREATE TABLE IF NOT EXISTS user_watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_user_id TEXT NOT NULL,
            instrument TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    `);

    db.run(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS user_watchlist_user_instrument_idx
        ON user_watchlist (telegram_user_id, instrument)
    `);
}
