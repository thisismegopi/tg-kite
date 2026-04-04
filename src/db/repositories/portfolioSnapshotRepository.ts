import { asc, desc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import { portfolioSnapshot } from '../schema';
import type { BotPlatform } from '../../types/bot';
import type { PortfolioSnapshotRecord, PortfolioSnapshotInput } from '../../types/storage';

const MAX_CHART_POINTS = 60;

function mapRow(row: typeof portfolioSnapshot.$inferSelect): PortfolioSnapshotRecord {
    return {
        id: row.id,
        actorId: row.actorId,
        platform: row.platform as BotPlatform,
        platformUserId: row.platformUserId,
        mfInvested: row.mfInvested,
        mfCurrent: row.mfCurrent,
        eqInvested: row.eqInvested,
        eqCurrent: row.eqCurrent,
        createdAt: row.createdAt,
    };
}

export function insertPortfolioSnapshot(dbFile: string, actorId: string, platform: BotPlatform, platformUserId: string, input: PortfolioSnapshotInput) {
    const { db } = getDb(dbFile);
    db.insert(portfolioSnapshot)
        .values({
            actorId,
            platform,
            platformUserId,
            mfInvested: input.mfInvested,
            mfCurrent: input.mfCurrent,
            eqInvested: input.eqInvested,
            eqCurrent: input.eqCurrent,
        })
        .run();
}

export function getLastPortfolioSnapshot(
    dbFile: string,
    actorId: string,
): PortfolioSnapshotRecord | null {
    const { db } = getDb(dbFile);
    const row = db
        .select()
        .from(portfolioSnapshot)
        .where(eq(portfolioSnapshot.actorId, actorId))
        .orderBy(desc(portfolioSnapshot.createdAt))
        .limit(1)
        .get();

    return row ? mapRow(row) : null;
}

export function listPortfolioSnapshotsForChart(
    dbFile: string,
    actorId: string,
): PortfolioSnapshotRecord[] {
    const { db } = getDb(dbFile);
    const rows = db
        .select()
        .from(portfolioSnapshot)
        .where(eq(portfolioSnapshot.actorId, actorId))
        .orderBy(asc(portfolioSnapshot.createdAt))
        .all();

    const mapped = rows.map(mapRow);
    if (mapped.length <= MAX_CHART_POINTS) {
        return mapped;
    }
    return mapped.slice(-MAX_CHART_POINTS);
}
