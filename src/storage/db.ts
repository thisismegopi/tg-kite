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
import type { BotPlatform } from '../types/bot';
import type { PortfolioSnapshotInput, StoredSessionInput } from '../types/storage';
import { config } from '../config';

function init() {
    return getDb(config.dbFile);
}

function close() {
    closeDb();
    console.log('Database connection closed.');
}

export = {
    init,
    saveUserSession: (actorId: string, platform: BotPlatform, platformUserId: string, sessionData: StoredSessionInput) =>
        saveUserSession(config.dbFile, actorId, platform, platformUserId, sessionData),
    getUserSession: (actorId: string) => getUserSession(config.dbFile, actorId),
    deleteUserSession: (actorId: string) => deleteUserSession(config.dbFile, actorId),
    getAiCredits: (actorId: string, platform?: BotPlatform, platformUserId?: string) => getAiCredits(config.dbFile, actorId, platform, platformUserId),
    consumeAiCredit: (actorId: string, platform?: BotPlatform, platformUserId?: string) => consumeAiCredit(config.dbFile, actorId, platform, platformUserId),
    addAiCredits: (actorId: string, amount: number, platform?: BotPlatform, platformUserId?: string) =>
        addAiCredits(config.dbFile, actorId, amount, platform, platformUserId),
    addWatchlistInstruments: (actorId: string, platform: BotPlatform, platformUserId: string, instruments: string[]) =>
        addWatchlistInstruments(config.dbFile, actorId, platform, platformUserId, instruments),
    getWatchlistInstruments: (actorId: string) => getWatchlistInstruments(config.dbFile, actorId),
    removeWatchlistInstruments: (actorId: string, instruments: string[]) => removeWatchlistInstruments(config.dbFile, actorId, instruments),
    getLastPortfolioSnapshot: (actorId: string) => getLastPortfolioSnapshot(config.dbFile, actorId),
    insertPortfolioSnapshot: (actorId: string, platform: BotPlatform, platformUserId: string, input: PortfolioSnapshotInput) =>
        insertPortfolioSnapshot(config.dbFile, actorId, platform, platformUserId, input),
    listPortfolioSnapshotsForChart: (actorId: string) => listPortfolioSnapshotsForChart(config.dbFile, actorId),
    close,
    DEFAULT_AI_CREDITS,
};
