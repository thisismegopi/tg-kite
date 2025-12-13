require('dotenv').config();

const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'KITE_API_KEY',
  'KITE_API_SECRET',
  'KITE_REDIRECT_URL'
];

// Check for missing environment variables
const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  console.error(`Error: Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please verify your .env file.');
  process.exit(1);
}

module.exports = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  kiteApiKey: process.env.KITE_API_KEY,
  kiteApiSecret: process.env.KITE_API_SECRET,
  kiteRedirectUrl: process.env.KITE_REDIRECT_URL,
  dbFile: process.env.DB_FILE || 'kite_bot.db',
  // AI Analysis (optional)
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
};

