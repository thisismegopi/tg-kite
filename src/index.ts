import db from './storage/db';
import { startTelegramBot } from './start';

db.init();

let telegramBot: { stop: (reason?: string) => void } | null = null;

async function main() {
    const [telegramResult] = await Promise.allSettled([startTelegramBot()]);

    if (telegramResult.status === 'fulfilled') {
        telegramBot = telegramResult.value;
    } else {
        console.error('Failed to start Telegram bot:', telegramResult.reason);
    }

    if (!telegramBot) {
        console.warn('No bot platform started. Configure TELEGRAM_BOT_TOKEN and/or DISCORD_BOT_TOKEN.');
    }
}

void main().catch(error => {
    console.error('Failed to start bot runtime:', error);
    process.exit(1);
});

function shutdown(signal: string) {
    console.log(`${signal} received. Shutting down...`);
    telegramBot?.stop(signal);
    db.close();
    process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
