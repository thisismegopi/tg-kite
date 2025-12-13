const KiteClient = require('../../kite/client');
const db = require('../../storage/db');

// Instantiate a temporary client just for generating URLs
// We don't need an access token for this.
const baseClient = new KiteClient();

const start = ctx => {
    ctx.reply(
        `👋 *Welcome to the Kite Trading Bot!*

I can help you manage your Zerodha portfolio and place orders directly from Telegram.

*Getting Started:*
1. Run /login to link your Zerodha account.
2. Once logged in, use /holdings or /positions to view your portfolio.
3. Use /buy or /sell to place orders.
4. Use /help to see all commands.

_Note: This is a demo bot. Ensure your API credentials are secure._`,
        { parse_mode: 'Markdown' },
    );
};

const help = ctx => {
    ctx.reply(
        `🤖 *Available Commands*

*Account*
/start - Welcome & Intro
/login - Connect Zerodha Kite
/logout - Disconnect account
/help - Show this menu

*Portfolio*
/portfolio - View Holdings (or /holdings)
/positions - View Net Positions
/balance - View Funds (or /funds)

*Trading*
/buy - Place Buy Order
  _Usage: /buy SYMBOL QTY [TYPE] [PRICE]_
/sell - Place Sell Order
/orders - List Recent Orders
/orderstatus <id> - Check Order Status

*Mutual Funds*
/mfholdings - View MF Holdings (or /mutualfunds)
/mforders - List MF Orders (7 days)
/mforder <id> - Check MF Order Details
/mfsips - View Active SIPs
/mfinstruments <query> - Search MF Schemes`,
        { parse_mode: 'Markdown' },
    );
};

const login = ctx => {
    const loginUrl = baseClient.generateLoginUrl();
    ctx.reply(
        `🔐 *Kite Login*

Click the link below to login to Zerodha.
[Login with Kite Connect](${loginUrl})

After logging in, you will be redirected to a URL that looks like:
\`https://your-redirect-url/?status=success&request_token=...\`

*Copy the request_token value* and send it here to complete the login.`,
        { parse_mode: 'Markdown' },
    );
};

const handleMessage = async (ctx, next) => {
    // If it's a command, skip (handled by other listeners)
    if (ctx.message.text && ctx.message.text.startsWith('/')) {
        return next();
    }

    // Check if it looks like a request token (usually 32 chars alphanumeric)
    const text = ctx.message.text.trim();
    if (text.length === 32 && !ctx.kite) {
        // Attempt to exchange token
        try {
            await ctx.reply('🔄 Verifying token...');
            const sessionResponse = await baseClient.generateSession(text);

            // sessionResponse = { user_type, email, user_name, user_shortname, broker, exchanges, products, order_types, api_key, access_token, public_token, ... }

            const sessionData = {
                access_token: sessionResponse.access_token,
                public_token: sessionResponse.public_token,
                user_id: sessionResponse.user_id,
                user_name: sessionResponse.user_name,
                avatar_url: sessionResponse.avatar_url,
                login_time: sessionResponse.login_time, // might need formatting or use Date.now()
            };

            db.saveUserSession(ctx.from.id, sessionData);

            // Re-initialize ctx.kite for immediate use if needed in same turn (though usually next command picks it up)
            ctx.kite = new KiteClient(sessionData.access_token);

            return ctx.reply(`✅ *Login Successful!*\n\nWelcome back, ${sessionResponse.user_name}.\nYou can now use /portfolio, /orders, etc.`, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error('Login error:', err);
            return ctx.reply(`❌ *Login Failed*\n\nError: ${err.message}\n\nThe token might be expired or invalid. Please run /login again.`, { parse_mode: 'Markdown' });
        }
    }

    return next();
};

const logout = ctx => {
    db.deleteUserSession(ctx.from.id);
    ctx.kite = null;
    ctx.reply('👋 You have been logged out.');
};

module.exports = {
    start,
    help,
    login,
    handleMessage,
    logout,
};
