import { eq, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { aiCredits } from '../schema';
import type { BotPlatform } from '../../types/bot';
import type { AiCreditsRecord } from '../../types/storage';

export const DEFAULT_AI_CREDITS = 10;

function mapCreditsRow(row: typeof aiCredits.$inferSelect): AiCreditsRecord {
    return {
        actorId: row.actorId,
        platform: row.platform as BotPlatform,
        platformUserId: row.platformUserId,
        credits: row.credits,
        totalUsed: row.totalUsed,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function ensureCreditsRow(dbFile: string, actorId: string, platform?: BotPlatform, platformUserId?: string) {
    const { db } = getDb(dbFile);
    const existing = db.select()
        .from(aiCredits)
        .where(eq(aiCredits.actorId, actorId))
        .get();

    if (existing) {
        return existing;
    }

    if (!platform || !platformUserId) {
        return null;
    }

    const now = Date.now();
    db.insert(aiCredits)
        .values({
            actorId,
            platform,
            platformUserId,
            credits: DEFAULT_AI_CREDITS,
            totalUsed: 0,
            createdAt: now,
            updatedAt: now,
        })
        .run();

    return db.select()
        .from(aiCredits)
        .where(eq(aiCredits.actorId, actorId))
        .get();
}

export function getAiCredits(dbFile: string, actorId: string, platform?: BotPlatform, platformUserId?: string) {
    const row = ensureCreditsRow(dbFile, actorId, platform, platformUserId);
    if (!row) {
        return { credits: DEFAULT_AI_CREDITS, totalUsed: 0 };
    }

    const mapped = mapCreditsRow(row);
    return {
        credits: mapped.credits,
        totalUsed: mapped.totalUsed,
    };
}

export function consumeAiCredit(dbFile: string, actorId: string, platform?: BotPlatform, platformUserId?: string) {
    const current = getAiCredits(dbFile, actorId, platform, platformUserId);
    if (current.credits <= 0) {
        return false;
    }

    const { db } = getDb(dbFile);
    db.update(aiCredits)
        .set({
            credits: sql`${aiCredits.credits} - 1`,
            totalUsed: sql`${aiCredits.totalUsed} + 1`,
            updatedAt: Date.now(),
        })
        .where(eq(aiCredits.actorId, actorId))
        .run();

    return true;
}

export function addAiCredits(dbFile: string, actorId: string, amount: number, platform?: BotPlatform, platformUserId?: string) {
    getAiCredits(dbFile, actorId, platform, platformUserId);

    const { db } = getDb(dbFile);
    db.update(aiCredits)
        .set({
            credits: sql`${aiCredits.credits} + ${amount}`,
            updatedAt: Date.now(),
        })
        .where(eq(aiCredits.actorId, actorId))
        .run();

    return getAiCredits(dbFile, actorId);
}
