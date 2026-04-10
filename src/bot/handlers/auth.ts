import { BotContext, NextFn } from '../../types/bot';

import KiteClient from '../../kite/client';
import db from '../../storage/db';

const baseClient = new KiteClient();

const start = async (ctx: BotContext) => {
    return await ctx.reply(
        `✨ *Welcome to the Kite Trading Bot!*

I can help you manage your Zerodha portfolio and place orders directly from Telegram.

*Getting Started:*
1. Run /login to link your Zerodha account.
2. Once logged in, use /holdings or /positions to view your portfolio.
3. Use /buy or /sell to place orders.
4. Use /help to see all commands.`,
        { parse_mode: 'Markdown' },
    );
};

const help = async (ctx: BotContext) => {
    return await ctx.reply(
        `✨ *Available Commands*

*Account*
/start - Welcome & Intro
/login - Connect Zerodha Kite
/logout - Disconnect account
/help - Show this menu

*Portfolio*
/portfolio - View Holdings (or /holdings)
/positions - View Net Positions
/balance - View Funds (or /funds)
/pfsnapshot - Snapshot MF & equity invested vs current (line chart; max 1 new snapshot / 7 days)

*Trading*
/buy - Place Buy Order
  _Usage: /buy SYMBOL QTY [TYPE] [PRICE]_
/sell - Place Sell Order
/orders - List Recent Orders
/orderstatus <id> - Check Order Status

*Market Data*
/quote <instrument> - Full market quote
/ohlc <instrument> - OHLC + LTP
/ltp <instrument> - Last traded price
/chart <instrument> <timeframe> - Candlestick chart image
/watchadd <instrument> - Add to watchlist
/watchremove <instrument> - Remove from watchlist
/watchlist - View watchlist image sorted by gainers
/top - Top 5 gainer and loosers from watchlist
/instruments [EXCHANGE] - Kite master instruments list as CSV file (optional: NSE, BSE, NFO, …)

*Mutual Funds*
/mfholdings - View MF Holdings
/mforders - List MF Orders (7 days)
/mforder <id> - Check MF Order Details
/mfsips - View Active SIPs
/mfinstruments - MF instruments list as CSV file

*✨ AI Analysis*
/analyze - Quick AI portfolio summary
/analyze detailed - Full breakdown
/analyze credits - Check AI credits
/analyze <question> - Ask anything!
  _Examples:_
  _/analyze what are my risky holdings?_
  _/analyze how diversified am I?_`,
        { parse_mode: 'Markdown' },
    );
};

const login = async (ctx: BotContext) => {
    const loginUrl = baseClient.generateLoginUrl();
    return await ctx.reply(
        `🔗 *Kite Login*

Click the Login Button below to login to Zerodha.

After logging in, you will be redirected to a URL that looks like:
\`https://your-redirect-url/?status=success&request_token=...\`

*Copy the request_token value* and send it here to complete the login.`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: 'Login ➜]', url: loginUrl }]],
            },
        },
    );
};

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

const handleMessage = async (ctx: BotContext, next: NextFn) => {
    const msg = ctx.message;
    if (!msg || !('text' in msg) || typeof msg.text !== 'string') {
        await next();
        return;
    }

    if (msg.text.startsWith('/')) {
        await next();
        return;
    }

    const text = msg.text.trim();
    if (text.length === 32 && !ctx.kite) {
        const from = ctx.from;
        if (!from) {
            await next();
            return;
        }

        try {
            await ctx.reply('🔄 Verifying token...');
            const sessionResponse = await baseClient.generateSession(text);

            const sessionData = {
                access_token: sessionResponse.access_token,
                public_token: sessionResponse.public_token,
                user_id: sessionResponse.user_id,
                user_name: sessionResponse.user_name,
                avatar_url: sessionResponse.avatar_url || null,
                login_time: sessionResponse.login_time,
            };

            db.saveUserSession(from.id, sessionData);
            ctx.kite = new KiteClient(sessionData.access_token);

            return await ctx.reply(`✅ *Login Successful!*\n\nWelcome back, ${sessionResponse.user_name}.\nYou can now use /portfolio, /orders, etc.`, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '👤Profile', callback_data: 'me' }]] },
            });
        } catch (err: unknown) {
            console.error('Login error:', err);
            return await ctx.reply(`❌ *Login Failed*\n\nError: ${errorMessage(err)}\n\nThe token might be expired or invalid. Please run /login again.`, { parse_mode: 'Markdown' });
        }
    }

    await next();
};

const logout = async (ctx: BotContext) => {
    try {
        const from = ctx.from;
        if (!from) {
            throw Error('Kite instance not found');
        }
        db.deleteUserSession(from.id);
        ctx.kite = null;
        return await ctx.reply('👋 You have been logged out.');
    } catch (error) {
        return await ctx.reply(errorMessage(error));
    }
};

const me = async (ctx: BotContext) => {
    try {
        if (!ctx.kite) {
            throw Error('Kite instance not found');
        }
        const profile = await ctx.kite.getProfile();
        const message =
            `👤 *Profile*\n\nUser ID: ||${profile.user_id}||\nUser Type: ${profile.user_type.split('_').join(' ')}\nEmail: ||${profile.email}||\nUser Name: ||${profile.user_name}||\n\nBroker: ${profile.broker}\nExchanges: ${profile.exchanges.join(', ')}\nProducts: ${profile.products.join(', ')}\nProduct Type: ${profile.order_types.join(', ')}\nDemat Consent: ${profile.meta.demat_consent.toUpperCase()}`
                .replace('.', '\\.')
                .replace('-', '\\-');
        return await ctx.reply(message, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📈Stocks Holdings', callback_data: 'holdings' },
                        { text: '📈MF Holdings', callback_data: 'mfholdings' },
                    ],
                    [{ text: 'Portfolio Snapshot 🖼️', callback_data: 'pfsnapshot' }],
                    [{ text: 'Fund 💰', callback_data: 'balance' }],
                    [{ text: 'Help❔', callback_data: 'help' }],
                    [{ text: 'Logout❗', callback_data: 'logout' }],
                ],
            },
        });
    } catch (error) {
        return await ctx.reply(errorMessage(error));
    }
};

export = {
    start,
    help,
    login,
    handleMessage,
    logout,
    me,
};
