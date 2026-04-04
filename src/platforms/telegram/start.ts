import { Telegraf } from 'telegraf';
import authHandlers from '../../bot/handlers/auth';
import authMiddleware from '../../bot/middleware/auth';
import { config } from '../../config';
import { dispatchAction, dispatchCommand } from '../routes';
import type { BotContext } from '../../types/bot';

export async function startTelegramBot() {
    if (!config.telegramBotToken) {
        return null;
    }

    const bot = new Telegraf<any>(config.telegramBotToken);

    bot.use((ctx: any, next: () => Promise<void>) => {
        ctx.platform = 'telegram';
        return authMiddleware.authMiddleware(ctx as BotContext, next);
    });

    for (const command of ['start', 'help', 'login', 'logout', 'me', 'holdings', 'portfolio', 'pfsnapshot', 'portfoliosnapshot', 'positions', 'balance', 'funds', 'account', 'buy', 'sell', 'orders', 'orderstatus', 'quote', 'ohlc', 'ltp', 'chart', 'watchadd', 'watchremove', 'watchlist', 'instruments', 'mfholdings', 'mutualfunds', 'mforders', 'mforder', 'mfsips', 'mfinstruments', 'analyze', 'aiportfolio']) {
        bot.command(command, (ctx: any) => dispatchCommand(command, ctx as BotContext));
    }

    for (const action of ['help', 'logout', 'me', 'holdings', 'pfsnapshot', 'positions', 'balance', 'orders', 'mfholdings', 'mforders', 'mfsips']) {
        bot.action(action, (ctx: any) => dispatchAction(action, ctx as BotContext));
    }

    bot.on('text', (ctx: any, next: () => Promise<void>) => authHandlers.handleMessage(ctx as BotContext, next));

    bot.catch((err, ctx) => {
        console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
        void ctx.reply('An unexpected error occurred. Please try again later.');
    });

    console.log('Kite Telegram Bot is starting...');
    await bot.launch();
    console.log('Telegram bot is running.');
    return bot;
}
