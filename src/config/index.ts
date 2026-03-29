import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'KITE_API_KEY', 'KITE_API_SECRET', 'KITE_REDIRECT_URL'] as const;

const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
    console.error(`Error: Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please verify your .env file.');
    process.exit(1);
}

const config = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN as string,
    kiteApiKey: process.env.KITE_API_KEY as string,
    kiteApiSecret: process.env.KITE_API_SECRET as string,
    kiteRedirectUrl: process.env.KITE_REDIRECT_URL as string,
    dbFile: process.env.DB_FILE || 'kite_bot.db',
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
};

export { config };
