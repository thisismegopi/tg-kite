import { eq } from "drizzle-orm";
import { getDb } from "../client";
import { sessions } from "../schema";
import type { SessionRecord, StoredSessionInput } from "../../types/storage";

function mapSessionRow(row: typeof sessions.$inferSelect): SessionRecord {
    return {
        telegramUserId: row.telegramUserId,
        requestToken: row.requestToken,
        accessToken: row.accessToken,
        publicToken: row.publicToken,
        kiteUserId: row.kiteUserId,
        userName: row.userName,
        avatarUrl: row.avatarUrl,
        loginTime: row.loginTime,
        expiresAt: row.expiresAt,
    };
}

export function saveUserSession(dbFile: string, telegramUserId: string | number, sessionData: StoredSessionInput) {
    const { db } = getDb(dbFile);
    const id = String(telegramUserId);

    db.insert(sessions)
        .values({
            telegramUserId: id,
            requestToken: sessionData.request_token ?? null,
            accessToken: sessionData.access_token ?? null,
            publicToken: sessionData.public_token ?? null,
            kiteUserId: sessionData.user_id ?? null,
            userName: sessionData.user_name ?? null,
            avatarUrl: sessionData.avatar_url ?? null,
            loginTime: sessionData.login_time ?? Date.now(),
            expiresAt: sessionData.expires_at ?? null,
        })
        .onConflictDoUpdate({
            target: sessions.telegramUserId,
            set: {
                requestToken: sessionData.request_token ?? null,
                accessToken: sessionData.access_token ?? null,
                publicToken: sessionData.public_token ?? null,
                kiteUserId: sessionData.user_id ?? null,
                userName: sessionData.user_name ?? null,
                avatarUrl: sessionData.avatar_url ?? null,
                loginTime: sessionData.login_time ?? Date.now(),
                expiresAt: sessionData.expires_at ?? null,
            },
        })
        .run();
}

export function getUserSession(dbFile: string, telegramUserId: string | number): SessionRecord | null {
    const { db } = getDb(dbFile);
    const row = db.select()
        .from(sessions)
        .where(eq(sessions.telegramUserId, String(telegramUserId)))
        .get();

    return row ? mapSessionRow(row) : null;
}

export function deleteUserSession(dbFile: string, telegramUserId: string | number) {
    const { db } = getDb(dbFile);
    return db.delete(sessions).where(eq(sessions.telegramUserId, String(telegramUserId))).run();
}
