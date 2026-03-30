import { addAiCredits, consumeAiCredit, getAiCredits } from '../db/repositories/aiCreditsRepository';
import { addWatchlistInstruments, getWatchlistInstruments, removeWatchlistInstruments } from '../db/repositories/watchlistRepository';
import { closeDb, getDb } from '../db/client';
import {
    getLastPortfolioSnapshot,
    insertPortfolioSnapshot,
    listPortfolioSnapshotsForChart,
} from '../db/repositories/portfolioSnapshotRepository';
import { deleteUserSession, getUserSession, saveUserSession } from '../db/repositories/sessionRepository';

import { DEFAULT_AI_CREDITS } from '../db/migrate';
import type { PortfolioSnapshotInput, StoredSessionInput } from '../types/storage';
import { config } from '../config';

function toLegacySessionShape(session: ReturnType<typeof getUserSession>) {
    if (!session) {
        return null;
    }

    return {
        telegram_user_id: session.telegramUserId,
        request_token: session.requestToken,
        access_token: session.accessToken,
        public_token: session.publicToken,
        kite_user_id: session.kiteUserId,
        user_name: session.userName,
        avatar_url: session.avatarUrl,
        login_time: session.loginTime,
        expires_at: session.expiresAt,
        telegramUserId: session.telegramUserId,
        requestToken: session.requestToken,
        accessToken: session.accessToken,
        publicToken: session.publicToken,
        kiteUserId: session.kiteUserId,
        userName: session.userName,
        avatarUrl: session.avatarUrl,
        loginTime: session.loginTime,
        expiresAt: session.expiresAt,
    };
}

function toLegacyWatchlistShape(entries: ReturnType<typeof getWatchlistInstruments>) {
    return entries.map(entry => ({
        instrument: entry.instrument,
        created_at: entry.createdAt,
        createdAt: entry.createdAt,
    }));
}

function init() {
    // ensureSchema(config.dbFile);
    return getDb(config.dbFile);
}

function close() {
    closeDb();
    console.log('Database connection closed.');
}

export = {
    init,
    saveUserSession: (telegramUserId: string | number, sessionData: StoredSessionInput) => saveUserSession(config.dbFile, telegramUserId, sessionData),
    getUserSession: (telegramUserId: string | number) => toLegacySessionShape(getUserSession(config.dbFile, telegramUserId)),
    deleteUserSession: (telegramUserId: string | number) => deleteUserSession(config.dbFile, telegramUserId),
    getAiCredits: (telegramUserId: string | number) => getAiCredits(config.dbFile, telegramUserId),
    consumeAiCredit: (telegramUserId: string | number) => consumeAiCredit(config.dbFile, telegramUserId),
    addAiCredits: (telegramUserId: string | number, amount: number) => addAiCredits(config.dbFile, telegramUserId, amount),
    addWatchlistInstruments: (telegramUserId: string | number, instruments: string[]) => addWatchlistInstruments(config.dbFile, telegramUserId, instruments),
    getWatchlistInstruments: (telegramUserId: string | number) => toLegacyWatchlistShape(getWatchlistInstruments(config.dbFile, telegramUserId)),
    removeWatchlistInstruments: (telegramUserId: string | number, instruments: string[]) => removeWatchlistInstruments(config.dbFile, telegramUserId, instruments),
    getLastPortfolioSnapshot: (telegramUserId: string | number) => getLastPortfolioSnapshot(config.dbFile, telegramUserId),
    insertPortfolioSnapshot: (telegramUserId: string | number, input: PortfolioSnapshotInput) =>
        insertPortfolioSnapshot(config.dbFile, telegramUserId, input),
    listPortfolioSnapshotsForChart: (telegramUserId: string | number) => listPortfolioSnapshotsForChart(config.dbFile, telegramUserId),
    close,
    DEFAULT_AI_CREDITS,
};
