const { Telegraf } = require('telegraf');
const config = require('./src/config');
const db = require('./src/storage/db');
const authMiddleware = require('./src/bot/middleware/auth');
const authHandlers = require('./src/bot/handlers/auth');
const portfolioHandlers = require('./src/bot/handlers/portfolio');
const orderHandlers = require('./src/bot/handlers/orders');
const mfHandlers = require('./src/bot/handlers/mutualFunds');
const analyzeHandlers = require('./src/bot/handlers/analyze');

// 1. Initialize Database
db.init();

// 2. Initialize Bot
const bot = new Telegraf(config.telegramBotToken);

// 3. Register Middleware
bot.use(authMiddleware.authMiddleware);

// 4. Command Handlers - Auth
bot.command('start', authHandlers.start);
bot.command('help', authHandlers.help);
bot.command('login', authHandlers.login);
bot.command('logout', authHandlers.logout);

// 5. Command Handlers - Portfolio (Require Auth)
bot.command(['holdings', 'portfolio'], authMiddleware.requireAuth, portfolioHandlers.holdings);
bot.command('positions', authMiddleware.requireAuth, portfolioHandlers.positions);
bot.command(['balance', 'funds', 'account'], authMiddleware.requireAuth, portfolioHandlers.balance);

// 6. Command Handlers - Orders (Require Auth)
bot.command(['buy', 'sell'], authMiddleware.requireAuth, orderHandlers.placeOrder);
bot.command('orders', authMiddleware.requireAuth, orderHandlers.listOrders);
bot.command('orderstatus', authMiddleware.requireAuth, orderHandlers.orderStatus);

// 7. Command Handlers - Mutual Funds (Require Auth)
bot.command(['mfholdings', 'mutualfunds'], authMiddleware.requireAuth, mfHandlers.mfHoldings);
bot.command('mforders', authMiddleware.requireAuth, mfHandlers.mfOrders);
bot.command('mforder', authMiddleware.requireAuth, mfHandlers.mfOrder);
bot.command('mfsips', authMiddleware.requireAuth, mfHandlers.mfSips);
bot.command('mfinstruments', authMiddleware.requireAuth, mfHandlers.mfInstruments);

// 8. Command Handlers - AI Analysis (Require Auth)
bot.command(['analyze', 'aiportfolio'], authMiddleware.requireAuth, analyzeHandlers.analyze);

// 9. General Message Handler (for Token input)
bot.on('text', authHandlers.handleMessage);


// 9. Error Handling
bot.catch((err, ctx) => {
    console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
    ctx.reply('⚠️ An unexpected error occurred. Please try again later.');
});

// 9. Launch
console.log('🚀 Kite Telegram Bot is starting...');
bot.launch().then(() => {
    console.log('✅ Bot is running!');
});

// 10. Graceful Shutdown
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
