import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { userWatchlist } from "../schema";
import type { WatchlistRecord } from "../../types/storage";

function mapWatchlistRow(row: typeof userWatchlist.$inferSelect): WatchlistRecord {
    return {
        instrument: row.instrument,
        createdAt: row.createdAt,
    };
}

export function addWatchlistInstruments(dbFile: string, telegramUserId: string | number, instruments: string[]) {
    const { db } = getDb(dbFile);
    const id = String(telegramUserId);
    const now = Date.now();
    let added = 0;

    for (const instrument of instruments) {
        const result = db.insert(userWatchlist)
            .values({
                telegramUserId: id,
                instrument,
                createdAt: now,
            })
            .onConflictDoNothing()
            .run();

        added += Number(result.changes ?? 0);
    }

    return added;
}

export function getWatchlistInstruments(dbFile: string, telegramUserId: string | number): WatchlistRecord[] {
    const { db } = getDb(dbFile);
    const rows = db.select()
        .from(userWatchlist)
        .where(eq(userWatchlist.telegramUserId, String(telegramUserId)))
        .orderBy(asc(userWatchlist.instrument))
        .all();

    return rows.map(mapWatchlistRow);
}

export function removeWatchlistInstruments(dbFile: string, telegramUserId: string | number, instruments: string[]) {
    const { db } = getDb(dbFile);
    const id = String(telegramUserId);
    let removed = 0;

    for (const instrument of instruments) {
        const result = db.delete(userWatchlist)
            .where(and(eq(userWatchlist.telegramUserId, id), eq(userWatchlist.instrument, instrument)))
            .run();

        removed += Number(result.changes ?? 0);
    }

    return removed;
}
