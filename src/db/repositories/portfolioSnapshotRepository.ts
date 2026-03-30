import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { portfolioSnapshot } from "../schema";
import type { PortfolioSnapshotRecord, PortfolioSnapshotInput } from "../../types/storage";

const MAX_CHART_POINTS = 60;

function mapRow(row: typeof portfolioSnapshot.$inferSelect): PortfolioSnapshotRecord {
    return {
        id: row.id,
        telegramUserId: row.telegramUserId,
        mfInvested: row.mfInvested,
        mfCurrent: row.mfCurrent,
        eqInvested: row.eqInvested,
        eqCurrent: row.eqCurrent,
        createdAt: row.createdAt,
    };
}

export function insertPortfolioSnapshot(dbFile: string, telegramUserId: string | number, input: PortfolioSnapshotInput) {
    const { db } = getDb(dbFile);
    const id = String(telegramUserId);
    db.insert(portfolioSnapshot)
        .values({
            telegramUserId: id,
            mfInvested: input.mfInvested,
            mfCurrent: input.mfCurrent,
            eqInvested: input.eqInvested,
            eqCurrent: input.eqCurrent,
        })
        .run();
}

export function getLastPortfolioSnapshot(
    dbFile: string,
    telegramUserId: string | number,
): PortfolioSnapshotRecord | null {
    const { db } = getDb(dbFile);
    const row = db
        .select()
        .from(portfolioSnapshot)
        .where(eq(portfolioSnapshot.telegramUserId, String(telegramUserId)))
        .orderBy(desc(portfolioSnapshot.createdAt))
        .limit(1)
        .get();

    return row ? mapRow(row) : null;
}

/** Oldest-first, for charting; capped for readability. */
export function listPortfolioSnapshotsForChart(
    dbFile: string,
    telegramUserId: string | number,
): PortfolioSnapshotRecord[] {
    const { db } = getDb(dbFile);
    const rows = db
        .select()
        .from(portfolioSnapshot)
        .where(eq(portfolioSnapshot.telegramUserId, String(telegramUserId)))
        .orderBy(asc(portfolioSnapshot.createdAt))
        .all();

    const mapped = rows.map(mapRow);
    if (mapped.length <= MAX_CHART_POINTS) {
        return mapped;
    }
    return mapped.slice(-MAX_CHART_POINTS);
}
