import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import { userWatchlist } from '../schema';
import type { BotPlatform } from '../../types/bot';
import type { WatchlistRecord } from '../../types/storage';

function mapWatchlistRow(row: typeof userWatchlist.$inferSelect): WatchlistRecord {
    return {
        actorId: row.actorId,
        platform: row.platform as BotPlatform,
        platformUserId: row.platformUserId,
        instrument: row.instrument,
        createdAt: row.createdAt,
    };
}

export function addWatchlistInstruments(dbFile: string, actorId: string, platform: BotPlatform, platformUserId: string, instruments: string[]) {
    const { db } = getDb(dbFile);
    const now = Date.now();
    let added = 0;

    for (const instrument of instruments) {
        const result = db.insert(userWatchlist)
            .values({
                actorId,
                platform,
                platformUserId,
                instrument,
                createdAt: now,
            })
            .onConflictDoNothing()
            .run();

        added += Number(result.changes ?? 0);
    }

    return added;
}

export function getWatchlistInstruments(dbFile: string, actorId: string): WatchlistRecord[] {
    const { db } = getDb(dbFile);
    const rows = db.select()
        .from(userWatchlist)
        .where(eq(userWatchlist.actorId, actorId))
        .orderBy(asc(userWatchlist.instrument))
        .all();

    return rows.map(mapWatchlistRow);
}

export function removeWatchlistInstruments(dbFile: string, actorId: string, instruments: string[]) {
    const { db } = getDb(dbFile);
    let removed = 0;

    for (const instrument of instruments) {
        const result = db.delete(userWatchlist)
            .where(and(eq(userWatchlist.actorId, actorId), eq(userWatchlist.instrument, instrument)))
            .run();

        removed += Number(result.changes ?? 0);
    }

    return removed;
}
