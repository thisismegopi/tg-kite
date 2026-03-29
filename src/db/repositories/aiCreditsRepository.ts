import { eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { aiCredits } from "../schema";
import type { AiCreditsRecord } from "../../types/storage";

export const DEFAULT_AI_CREDITS = 10;

function mapCreditsRow(row: typeof aiCredits.$inferSelect): AiCreditsRecord {
    return {
        telegramUserId: row.telegramUserId,
        credits: row.credits,
        totalUsed: row.totalUsed,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function ensureCreditsRow(dbFile: string, telegramUserId: string) {
    const { db } = getDb(dbFile);
    const existing = db.select()
        .from(aiCredits)
        .where(eq(aiCredits.telegramUserId, telegramUserId))
        .get();

    if (existing) {
        return existing;
    }

    const now = Date.now();
    db.insert(aiCredits)
        .values({
            telegramUserId,
            credits: DEFAULT_AI_CREDITS,
            totalUsed: 0,
            createdAt: now,
            updatedAt: now,
        })
        .run();

    return db.select()
        .from(aiCredits)
        .where(eq(aiCredits.telegramUserId, telegramUserId))
        .get();
}

export function getAiCredits(dbFile: string, telegramUserId: string | number) {
    const row = ensureCreditsRow(dbFile, String(telegramUserId));
    if (!row) {
        return { credits: DEFAULT_AI_CREDITS, totalUsed: 0 };
    }

    const mapped = mapCreditsRow(row);
    return {
        credits: mapped.credits,
        totalUsed: mapped.totalUsed,
    };
}

export function consumeAiCredit(dbFile: string, telegramUserId: string | number) {
    const id = String(telegramUserId);
    const current = getAiCredits(dbFile, id);
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
        .where(eq(aiCredits.telegramUserId, id))
        .run();

    return true;
}

export function addAiCredits(dbFile: string, telegramUserId: string | number, amount: number) {
    const id = String(telegramUserId);
    getAiCredits(dbFile, id);

    const { db } = getDb(dbFile);
    db.update(aiCredits)
        .set({
            credits: sql`${aiCredits.credits} + ${amount}`,
            updatedAt: Date.now(),
        })
        .where(eq(aiCredits.telegramUserId, id))
        .run();

    return getAiCredits(dbFile, id);
}
