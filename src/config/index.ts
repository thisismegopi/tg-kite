import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
    'TELEGRAM_BOT_TOKEN',
    'KITE_API_KEY',
    'KITE_API_SECRET',
    'KITE_REDIRECT_URL',
    'SESSION_ENCRYPTION_KEY',
] as const;

function parseSessionEncryptionKey(value: string): Buffer {
    const trimmed = value.trim();
    if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
        return Buffer.from(trimmed, 'hex');
    }
    const key = Buffer.from(trimmed, 'base64');
    if (key.length !== 32) {
        console.error(
            'Error: SESSION_ENCRYPTION_KEY must be 32 bytes (64 hex chars, or base64 from openssl rand -base64 32).',
        );
        process.exit(1);
    }
    return key;
}

const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
    console.error(`Error: Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please verify your .env file.');
    process.exit(1);
}

const config = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN as string,
    telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || process.env.BOT_USERNAME || '',
    kiteApiKey: process.env.KITE_API_KEY as string,
    kiteApiSecret: process.env.KITE_API_SECRET as string,
    kiteRedirectUrl: process.env.KITE_REDIRECT_URL as string,
    sessionEncryptionKey: parseSessionEncryptionKey(process.env.SESSION_ENCRYPTION_KEY as string),
    dbFile: process.env.DB_FILE || 'kite_bot.db',
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
};

export { config };
