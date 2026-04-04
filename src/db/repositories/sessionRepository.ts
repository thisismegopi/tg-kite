import { eq } from 'drizzle-orm';
import { encryptSessionToken, decryptSessionToken } from '../../crypto/sessionTokenCrypto';
import { config } from '../../config';
import { getDb } from '../client';
import { sessions } from '../schema';
import type { BotPlatform } from '../../types/bot';
import type { SessionRecord, StoredSessionInput } from '../../types/storage';

function mapSessionRow(row: typeof sessions.$inferSelect): SessionRecord {
    const k = config.sessionEncryptionKey;
    return {
        actorId: row.actorId,
        platform: row.platform as BotPlatform,
        platformUserId: row.platformUserId,
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

export function saveUserSession(dbFile: string, actorId: string, platform: BotPlatform, platformUserId: string, sessionData: StoredSessionInput) {
    const { db } = getDb(dbFile);
    const k = config.sessionEncryptionKey;

    db.insert(sessions)
        .values({
            actorId,
            platform,
            platformUserId,
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
            target: sessions.actorId,
            set: {
                platform,
                platformUserId,
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

export function getUserSession(dbFile: string, actorId: string): SessionRecord | null {
    const { db } = getDb(dbFile);
    const row = db.select()
        .from(sessions)
        .where(eq(sessions.actorId, actorId))
        .get();

    return row ? mapSessionRow(row) : null;
}

export function deleteUserSession(dbFile: string, actorId: string) {
    const { db } = getDb(dbFile);
    return db.delete(sessions).where(eq(sessions.actorId, actorId)).run();
}
