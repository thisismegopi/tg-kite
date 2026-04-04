import { dispatchAction, dispatchCommand, getRouteActionNames, getRouteCommandNames } from './route';

import { BotContext } from './types/bot';
import { Telegraf } from 'telegraf';
import authHandlers from './bot/handlers/auth';
import authMiddlewareModule from './bot/middleware/auth';
import { config } from './config';

export async function startTelegramBot() {
    if (!config.telegramBotToken) {
        return null;
    }

    const bot = new Telegraf<BotContext>(config.telegramBotToken);

    bot.use((ctx: BotContext, next: () => Promise<void>) => {
        return authMiddlewareModule.authMiddleware(ctx, next);
    });

    for (const command of getRouteCommandNames()) {
        bot.command(command, (ctx: BotContext) => dispatchCommand(command, ctx));
    }

    for (const action of getRouteActionNames()) {
        bot.action(action, (ctx: BotContext) => dispatchAction(action, ctx));
    }

    bot.on('text', (ctx: BotContext, next: () => Promise<void>) => authHandlers.handleMessage(ctx as BotContext, next));

    bot.catch((err, ctx) => {
        console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
        void ctx.reply('An unexpected error occurred. Please try again later.');
    });

    console.log('Kite Telegram Bot is starting...');
    void bot.launch().catch((err: unknown) => {
        console.error('Telegram bot launch failed:', err);
        process.exit(1);
    });
    console.log('Telegram bot is running.');
    return bot;
}
