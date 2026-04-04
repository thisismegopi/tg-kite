import db from './storage/db';
import { startDiscordBot } from './platforms/discord/start';
import { startTelegramBot } from './platforms/telegram/start';

db.init();

let telegramBot: { stop: (reason?: string) => void } | null = null;
let discordBot: { destroy: () => void } | null = null;

async function main() {
    const [telegramResult, discordResult] = await Promise.allSettled([startTelegramBot(), startDiscordBot()]);

    if (telegramResult.status === 'fulfilled') {
        telegramBot = telegramResult.value;
    } else {
        console.error('Failed to start Telegram bot:', telegramResult.reason);
    }

    if (discordResult.status === 'fulfilled') {
        discordBot = discordResult.value;
    } else {
        console.error('Failed to start Discord bot:', discordResult.reason);
    }

    if (!telegramBot && !discordBot) {
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
    discordBot?.destroy();
    db.close();
    process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
