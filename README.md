# Telegram Kite Trading Bot

A Node.js Telegram bot for Zerodha Kite Connect v3. It supports authentication, portfolio views, orders, mutual funds, market quotes, historical chart images, and optional AI-powered portfolio analysis.

## Features

- Kite login flow for Telegram users
- Portfolio holdings, positions, and funds lookup
- Order placement and order status tracking
- Market data commands for quote, OHLC, and LTP
- Per-user instrument watchlist stored in SQLite
- Historical candlestick chart images in chat
- Mutual fund holdings, orders, SIPs, and instrument search
- Optional Gemini-based portfolio analysis with credit tracking
- SQLite persistence for user sessions and AI credits

## Prerequisites

- Node.js 16+
- Zerodha Kite Connect app
- Telegram bot token from `@BotFather`
- Optional Gemini API key for `/analyze`

## Setup

1. Clone the repository.

```bash
git clone https://github.com/yourusername/tg-kite.git
cd tg-kite
```

2. Install dependencies.

```bash
npm install
```

3. Copy the environment file and fill in your values.

```bash
cp .env.example .env
```

Required variables:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
KITE_API_KEY=your_kite_api_key
KITE_API_SECRET=your_kite_api_secret
KITE_REDIRECT_URL=https://youruser.github.io/tg-kite/pages/
DB_FILE=kite_bot.db
```

Optional AI variables:

```env
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash
```

4. Configure the static login page in [pages/index.html](pages/index.html) with your bot username.

5. Start the bot.

```bash
npm start
```

## Login Flow

1. Open the bot in Telegram.
2. Run `/login`.
3. Complete the Zerodha login in the browser.
4. Copy the `request_token` from the redirect page.
5. Paste the token back into the Telegram chat.

## Commands

### Core

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show command list |
| `/login` | Start Kite login flow |
| `/logout` | Clear saved session |

### Portfolio

| Command | Description |
|---------|-------------|
| `/portfolio` or `/holdings` | Show equity holdings |
| `/positions` | Show net positions |
| `/funds` or `/balance` | Show account funds |

### Orders

| Command | Description |
|---------|-------------|
| `/buy <SYMBOL> <QTY>` | Place a buy order |
| `/sell <SYMBOL> <QTY>` | Place a sell order |
| `/orders` | Show recent orders |
| `/orderstatus <ORDER_ID>` | Show order status |

Examples:

- `/buy TCS 10`
- `/buy INFY 5 LIMIT 1450`
- `/sell RELIANCE 10 MARKET MIS`

### Market Data

| Command | Description |
|---------|-------------|
| `/quote <INSTRUMENT>` | Full quote snapshot |
| `/ohlc <INSTRUMENT>` | OHLC + LTP |
| `/ltp <INSTRUMENT>` | Last traded price |
| `/chart <INSTRUMENT> <TIMEFRAME>` | Candlestick chart image |
| `/watchadd <INSTRUMENT>` | Add instrument(s) to your watchlist |
| `/watchremove <INSTRUMENT>` | Remove instrument(s) from your watchlist |
| `/watchlist` | View watchlist image sorted by gainers/losers |

Supported chart timeframes:

- `1m`
- `3m`
- `5m`
- `30m`
- `1h`
- `1d`
- `1w`
- `1M`
- `12M`

Examples:

- `/quote NSE:INFY`
- `/ohlc INFY`
- `/ltp NSE:INFY`
- `/chart NSE:INFY 5m`
- `/chart INFY 1d`
- `/chart NSE:NIFTY%2050 1w`
- `/chart NIFTY 50 1w`

Notes:

- Plain symbols default to `NSE:`.
- For quote-style commands, instruments with spaces should be passed as quoted strings or URL-encoded.
- Examples: `/quote "NIFTY 50"` or `/quote NSE:NIFTY%2050`
- For multiple instruments, prefer comma-separated input.
- Example: `/ltp "NIFTY 50", NSE:INFY`

### Mutual Funds

| Command | Description |
|---------|-------------|
| `/mfholdings` | Show MF holdings |
| `/mforders` | Show recent MF orders |
| `/mforder <ORDER_ID>` | Show MF order details |
| `/mfsips` | Show SIPs |
| `/mfinstruments <QUERY>` | Search MF instruments |

### AI Analysis

| Command | Description |
|---------|-------------|
| `/analyze` | Quick AI portfolio summary |
| `/analyze detailed` | Detailed AI breakdown |
| `/analyze credits` | Show remaining AI credits |
| `/analyze <QUESTION>` | Ask a portfolio question |

Examples:

- `/analyze what are my risky holdings?`
- `/analyze how diversified am I?`
- `/analyze which sector am I overexposed to?`

## Project Structure

```text
tg-kite/
|-- pages/
|   `-- index.html
|-- src/
|   |-- ai/
|   |-- bot/
|   |   |-- handlers/
|   |   `-- middleware/
|   |-- chart/
|   |-- config/
|   |-- kite/
|   `-- storage/
|-- index.js
|-- package.json
`-- README.md
```

## Storage

SQLite tables:

- `sessions`: Kite session data per Telegram user
- `ai_credits`: AI credit balance and usage tracking
- `user_watchlist`: saved instruments per Telegram user

## Notes

- Historical chart rendering is generated locally and sent as a PNG image.
- Weekly, monthly, and 12-month chart views are aggregated locally from daily candle data.
- AI analysis is educational only and not investment advice.

## License

ISC
