import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const sessions = sqliteTable("sessions", {
    telegramUserId: text("telegram_user_id").primaryKey(),
    requestToken: text("request_token"),
    accessToken: text("access_token"),
    publicToken: text("public_token"),
    kiteUserId: text("kite_user_id"),
    userName: text("user_name"),
    avatarUrl: text("avatar_url"),
    loginTime: integer("login_time"),
    expiresAt: integer("expires_at"),
});

export const aiCredits = sqliteTable("ai_credits", {
    telegramUserId: text("telegram_user_id").primaryKey(),
    credits: integer("credits").notNull().default(10),
    totalUsed: integer("total_used").notNull().default(0),
    createdAt: integer("created_at"),
    updatedAt: integer("updated_at"),
});

export const userWatchlist = sqliteTable(
    "user_watchlist",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        telegramUserId: text("telegram_user_id").notNull(),
        instrument: text("instrument").notNull(),
        createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
    },
    table => ({
        userInstrumentUnique: uniqueIndex("user_watchlist_user_instrument_idx").on(table.telegramUserId, table.instrument),
    }),
);
