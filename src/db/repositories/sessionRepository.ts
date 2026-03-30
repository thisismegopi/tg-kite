import { eq } from "drizzle-orm";
import { encryptSessionToken, decryptSessionToken } from "../../crypto/sessionTokenCrypto";
import { config } from "../../config";
import { getDb } from "../client";
import { sessions } from "../schema";
import type { SessionRecord, StoredSessionInput } from "../../types/storage";

function mapSessionRow(row: typeof sessions.$inferSelect): SessionRecord {
    const k = config.sessionEncryptionKey;
    return {
        telegramUserId: row.telegramUserId,
        requestToken: decryptSessionToken(row.requestToken, k),
        accessToken: decryptSessionToken(row.accessToken, k),
        publicToken: decryptSessionToken(row.publicToken, k),
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
    const k = config.sessionEncryptionKey;

    db.insert(sessions)
        .values({
            telegramUserId: id,
            requestToken: encryptSessionToken(sessionData.request_token ?? null, k),
            accessToken: encryptSessionToken(sessionData.access_token ?? null, k),
            publicToken: encryptSessionToken(sessionData.public_token ?? null, k),
            kiteUserId: sessionData.user_id ?? null,
            userName: sessionData.user_name ?? null,
            avatarUrl: sessionData.avatar_url ?? null,
            loginTime: sessionData.login_time ?? Date.now(),
            expiresAt: sessionData.expires_at ?? null,
        })
        .onConflictDoUpdate({
            target: sessions.telegramUserId,
            set: {
                requestToken: encryptSessionToken(sessionData.request_token ?? null, k),
                accessToken: encryptSessionToken(sessionData.access_token ?? null, k),
                publicToken: encryptSessionToken(sessionData.public_token ?? null, k),
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
