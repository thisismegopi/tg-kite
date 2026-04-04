import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { sql } from 'drizzle-orm';

export const sessions = sqliteTable('sessions', {
    actorId: text('actor_id').primaryKey(),
    platform: text('platform').notNull(),
    platformUserId: text('platform_user_id').notNull(),
    requestToken: text('request_token'),
    accessToken: text('access_token'),
    publicToken: text('public_token'),
    kiteUserId: text('kite_user_id'),
    userName: text('user_name'),
    avatarUrl: text('avatar_url'),
    loginTime: integer('login_time'),
    expiresAt: integer('expires_at'),
});

export const aiCredits = sqliteTable('ai_credits', {
    actorId: text('actor_id').primaryKey(),
    platform: text('platform').notNull(),
    platformUserId: text('platform_user_id').notNull(),
    credits: integer('credits').notNull().default(10),
    totalUsed: integer('total_used').notNull().default(0),
    createdAt: integer('created_at'),
    updatedAt: integer('updated_at'),
});

export const userWatchlist = sqliteTable(
    'user_watchlist',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        actorId: text('actor_id').notNull(),
        platform: text('platform').notNull(),
        platformUserId: text('platform_user_id').notNull(),
        instrument: text('instrument').notNull(),
        createdAt: integer('created_at')
            .notNull()
            .default(sql`(unixepoch() * 1000)`),
    },
    table => ({
        userInstrumentUnique: uniqueIndex('user_watchlist_user_instrument_idx').on(table.actorId, table.instrument),
    }),
);

export const portfolioSnapshot = sqliteTable('portfolio_snapshot', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    actorId: text('actor_id').notNull(),
    platform: text('platform').notNull(),
    platformUserId: text('platform_user_id').notNull(),
    mfInvested: integer('mf_invested').notNull(),
    mfCurrent: integer('mf_current').notNull(),
    eqInvested: integer('eq_invested').notNull(),
    eqCurrent: integer('eq_current').notNull(),
    createdAt: integer('created_at')
        .notNull()
        .default(sql`(unixepoch() * 1000)`),
});
