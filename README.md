# Telegram Kite Trading Bot

A production-ready Node.js Telegram bot for trading on Zerodha using the Kite Connect v3 API. This bot allows you to manage your portfolio, view funds, and place orders directly from Telegram.

## 🚀 Features

- **Authentication**: Secure login flow using Kite Connect (supports per-user sessions).
- **Portfolio Management**: View current holdings with P&L and net positions.
- **Funds**: Check available equity and commodity balance.
- **Order Management**:
  - Place Market and Limit orders (Buy/Sell).
  - List recent orders.
  - Check order status.
- **Persistence**: SQLite storage to persist user sessions (no need to login daily until token expires).
- **Security**: Environment variable configuration for API secrets.

## 📋 Prerequisites

- **Node.js**: v16 or higher.
- **Zerodha Kite Connect App**: You need a Kite Connect developer account.
  - Create an app to get `API_KEY` and `API_SECRET`.
  - Set the **Redirect URL** (e.g., `https://kite.trade` or your own URL).
- **Telegram Bot**: Create a bot via [@BotFather](https://t.me/BotFather) to get the `BOT_TOKEN`.

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/tg-kite.git
   cd tg-kite
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Copy the example environment file:
   ```bash
   cp env.example .env
   ```
   Edit `.env` and fill in your credentials:
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   KITE_API_KEY=your_kite_api_key
   KITE_API_SECRET=your_kite_api_secret
   KITE_REDIRECT_URL=https://kite.trade
   DB_FILE=kite_bot.db
   ```
   > **Note**: `KITE_REDIRECT_URL` must match exactly what is set in your Zerodha Developer console.

## ▶️ Usage

1. **Start the Bot**
   ```bash
   npm start
   # OR
   node index.js
   ```

2. **Open Telegram**
   Search for your bot and click **Start**.

3. **Login Flow**
   - Send `/login`.
   - Click the generated login link to authenticate with Zerodha.
   - You will be redirected to your Redirect URL.
   - Copy the `request_token` from the URL (e.g., `...&request_token=YOUR_TOKEN&...`).
   - Paste the token into the Telegram chat.

## 🤖 Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and instructions |
| `/login` | Generate Kite login link |
| `/logout` | Clear local session data |
| `/help` | List available commands |
| `/portfolio` | View current holdings and P&L |
| `/positions` | View net positions (Day + Carry) |
| `/funds` | View available account balance |
| `/orders` | List recent orders for the day |
| `/buy <SYMBOL> <QTY>` | Place a buy order (Default: Market, CNC) |
| `/sell <SYMBOL> <QTY>` | Place a sell order |

**Order Examples:**
- Market Order (Default): `/buy TCS 10`
- Limit Order: `/buy INFY 5 LIMIT 1450`
- Intraday (MIS): `/sell RELIANCE 10 MARKET MIS`

## 📂 Project Structure

```
tg-kite/
├── src/
│   ├── bot/
│   │   ├── handlers/    # Command logic (auth, orders, portfolio)
│   │   └── middleware/  # Auth middleware
│   ├── kite/            # Kite Connect API wrapper
│   ├── storage/         # SQLite database adapter
│   └── config/          # Environment configuration
├── index.js             # Entry point
├── .env                 # Secrets (gitignored)
└── package.json
```

## ⚠️ Disclaimer

This software is for educational purposes only. Trading involves financial risk. The developers are not responsible for any financial losses incurred while using this bot. Ensure you test with small quantities before trading with significant capital.

## 📄 License

ISC

