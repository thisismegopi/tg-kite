const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

let db;

function init() {
    if (db) return db;

    const dbPath = path.resolve(process.cwd(), config.dbFile);
    db = new Database(dbPath, { verbose: null }); // Set verbose: console.log to see queries

    // Create table for storing sessions
    // We store basic info + tokens
    const createTableQuery = `
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

    db.exec(createTableQuery);
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
    close,
};
