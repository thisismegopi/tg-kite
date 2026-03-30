import { Telegraf } from 'telegraf';
import analyzeHandlers from './bot/handlers/analyze';
import authHandlers from './bot/handlers/auth';
import authMiddleware from './bot/middleware/auth';
import chartHandlers from './bot/handlers/chart';
import { config } from './config';
import db from './storage/db';
import marketQuoteHandlers from './bot/handlers/marketQuotes';
import mfHandlers from './bot/handlers/mutualFunds';
import orderHandlers from './bot/handlers/orders';
import portfolioHandlers from './bot/handlers/portfolio';
import portfolioSnapshotHandlers from './bot/handlers/portfolioSnapshot';
import watchlistHandlers from './bot/handlers/watchlist';

db.init();

const bot = new Telegraf(config.telegramBotToken);

bot.use(authMiddleware.authMiddleware);

bot.command('start', authHandlers.start);
bot.command('help', authHandlers.help);
bot.command('login', authHandlers.login);
bot.command('logout', authHandlers.logout);

bot.command(['holdings', 'portfolio'], authMiddleware.requireAuth, portfolioHandlers.holdings);
bot.command(['pfsnapshot', 'portfoliosnapshot'], authMiddleware.requireAuth, portfolioSnapshotHandlers.portfolioSnapshot);
bot.command('positions', authMiddleware.requireAuth, portfolioHandlers.positions);
bot.command(['balance', 'funds', 'account'], authMiddleware.requireAuth, portfolioHandlers.balance);

bot.command(['buy', 'sell'], authMiddleware.requireAuth, orderHandlers.placeOrder);
bot.command('orders', authMiddleware.requireAuth, orderHandlers.listOrders);
bot.command('orderstatus', authMiddleware.requireAuth, orderHandlers.orderStatus);
bot.command('quote', authMiddleware.requireAuth, marketQuoteHandlers.quote);
bot.command('ohlc', authMiddleware.requireAuth, marketQuoteHandlers.ohlc);
bot.command('ltp', authMiddleware.requireAuth, marketQuoteHandlers.ltp);
bot.command('chart', authMiddleware.requireAuth, chartHandlers.chart);
bot.command('watchadd', authMiddleware.requireAuth, watchlistHandlers.add);
bot.command('watchremove', authMiddleware.requireAuth, watchlistHandlers.remove);
bot.command('watchlist', authMiddleware.requireAuth, watchlistHandlers.list);

bot.command(['mfholdings', 'mutualfunds'], authMiddleware.requireAuth, mfHandlers.mfHoldings);
bot.command('mforders', authMiddleware.requireAuth, mfHandlers.mfOrders);
bot.command('mforder', authMiddleware.requireAuth, mfHandlers.mfOrder);
bot.command('mfsips', authMiddleware.requireAuth, mfHandlers.mfSips);
bot.command('mfinstruments', authMiddleware.requireAuth, mfHandlers.mfInstruments);

bot.command(['analyze', 'aiportfolio'], authMiddleware.requireAuth, analyzeHandlers.analyze);

bot.on('text', authHandlers.handleMessage);

bot.catch((err, ctx) => {
    console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
    void ctx.reply('An unexpected error occurred. Please try again later.');
});

console.log('Kite Telegram Bot is starting...');
bot.launch().then(() => {
    console.log('Bot is running!');
});

process.once('SIGINT', () => {
    console.log('SIGINT received. Shutting down...');
    bot.stop('SIGINT');
    db.close();
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down...');
    bot.stop('SIGTERM');
    db.close();
    process.exit(0);
});
