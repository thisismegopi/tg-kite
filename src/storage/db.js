const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

let db;

// Default credits for new users
const DEFAULT_AI_CREDITS = 10;

function init() {
    if (db) return db;

    const dbPath = path.resolve(process.cwd(), config.dbFile);
    db = new Database(dbPath, { verbose: null }); // Set verbose: console.log to see queries

    // Create table for storing sessions
    // We store basic info + tokens
    const createSessionsTable = `
    CREATE TABLE IF NOT EXISTS sessions (
      telegram_user_id TEXT PRIMARY KEY,
      request_token TEXT,
      access_token TEXT,
      public_token TEXT,
      kite_user_id TEXT,
      user_name TEXT,
      avatar_url TEXT,
      login_time INTEGER,
      expires_at INTEGER
    )
  `;

    // Create table for AI credits
    const createCreditsTable = `
    CREATE TABLE IF NOT EXISTS ai_credits (
      telegram_user_id TEXT PRIMARY KEY,
      credits INTEGER DEFAULT ${DEFAULT_AI_CREDITS},
      total_used INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )
  `;

    const createWatchlistTable = `
    CREATE TABLE IF NOT EXISTS user_watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id TEXT NOT NULL,
      instrument TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (telegram_user_id, instrument)
    )
  `;

    db.exec(createSessionsTable);
    db.exec(createCreditsTable);
    db.exec(createWatchlistTable);
    console.log('Database initialized successfully.');
    return db;
}

function saveUserSession(telegramUserId, sessionData) {
    if (!db) init();

    const { access_token, public_token, user_id: kite_user_id, user_name, avatar_url, login_time } = sessionData;

    const stmt = db.prepare(`
    INSERT OR REPLACE INTO sessions 
    (telegram_user_id, access_token, public_token, kite_user_id, user_name, avatar_url, login_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    const info = stmt.run(String(telegramUserId), access_token, public_token, kite_user_id, user_name, avatar_url, login_time || Date.now());

    return info;
}

function getUserSession(telegramUserId) {
    if (!db) init();

    const stmt = db.prepare('SELECT * FROM sessions WHERE telegram_user_id = ?');
    const row = stmt.get(String(telegramUserId));
    return row;
}

function deleteUserSession(telegramUserId) {
    if (!db) init();

    const stmt = db.prepare('DELETE FROM sessions WHERE telegram_user_id = ?');
    const info = stmt.run(String(telegramUserId));
    return info;
}

// --- AI Credits Management ---

/**
 * Get user's AI credits. Creates record with default credits if not exists.
 */
function getAiCredits(telegramUserId) {
    if (!db) init();
    const id = String(telegramUserId);

    let row = db.prepare('SELECT * FROM ai_credits WHERE telegram_user_id = ?').get(id);
    
    if (!row) {
        // Create new record with default credits
        const now = Date.now();
        db.prepare(`
            INSERT INTO ai_credits (telegram_user_id, credits, total_used, created_at, updated_at)
            VALUES (?, ?, 0, ?, ?)
        `).run(id, DEFAULT_AI_CREDITS, now, now);
        
        row = { credits: DEFAULT_AI_CREDITS, total_used: 0 };
    }

    return {
        credits: row.credits,
        totalUsed: row.total_used
    };
}

/**
 * Consume 1 AI credit for user. Returns true if successful, false if no credits.
 */
function consumeAiCredit(telegramUserId) {
    if (!db) init();
    const id = String(telegramUserId);

    const current = getAiCredits(id);
    
    if (current.credits <= 0) {
        return false;
    }

    const now = Date.now();
    db.prepare(`
        UPDATE ai_credits 
        SET credits = credits - 1, total_used = total_used + 1, updated_at = ?
        WHERE telegram_user_id = ?
    `).run(now, id);

    return true;
}

/**
 * Add credits to user's account
 */
function addAiCredits(telegramUserId, amount) {
    if (!db) init();
    const id = String(telegramUserId);

    // Ensure record exists
    getAiCredits(id);

    const now = Date.now();
    db.prepare(`
        UPDATE ai_credits 
        SET credits = credits + ?, updated_at = ?
        WHERE telegram_user_id = ?
    `).run(amount, now, id);

    return getAiCredits(id);
}

function addWatchlistInstruments(telegramUserId, instruments) {
    if (!db) init();

    const id = String(telegramUserId);
    const now = Date.now();
    const insert = db.prepare(`
        INSERT OR IGNORE INTO user_watchlist (telegram_user_id, instrument, created_at)
        VALUES (?, ?, ?)
    `);

    const transaction = db.transaction(items => {
        let added = 0;
        for (const instrument of items) {
            const info = insert.run(id, instrument, now);
            added += info.changes;
        }
        return added;
    });

    return transaction(instruments);
}

function getWatchlistInstruments(telegramUserId) {
    if (!db) init();

    return db.prepare(`
        SELECT instrument, created_at
        FROM user_watchlist
        WHERE telegram_user_id = ?
        ORDER BY instrument ASC
    `).all(String(telegramUserId));
}

function removeWatchlistInstruments(telegramUserId, instruments) {
    if (!db) init();

    const id = String(telegramUserId);
    const remove = db.prepare(`
        DELETE FROM user_watchlist
        WHERE telegram_user_id = ? AND instrument = ?
    `);

    const transaction = db.transaction(items => {
        let removed = 0;
        for (const instrument of items) {
            const info = remove.run(id, instrument);
            removed += info.changes;
        }
        return removed;
    });

    return transaction(instruments);
}

function close() {
    if (db) {
        db.close();
        db = null;
        console.log('Database connection closed.');
    }
}

module.exports = {
    init,
    saveUserSession,
    getUserSession,
    deleteUserSession,
    getAiCredits,
    consumeAiCredit,
    addAiCredits,
    addWatchlistInstruments,
    getWatchlistInstruments,
    removeWatchlistInstruments,
    close,
    DEFAULT_AI_CREDITS
};
