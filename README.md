# Telegram Kite Trading Bot

A production-ready Node.js Telegram bot for trading on Zerodha using the Kite Connect v3 API. This bot allows you to manage your portfolio, view funds, place orders, and get **AI-powered portfolio analysis** directly from Telegram.

## 🚀 Features

- **Authentication**: Secure login flow using Kite Connect (supports per-user sessions).
- **Portfolio Management**: View current holdings with P&L and net positions.
- **Funds**: Check available equity and commodity balance.
- **Order Management**:
  - Place Market and Limit orders (Buy/Sell).
  - List recent orders.
  - Check order status.
- **Mutual Funds**: View MF holdings, orders, SIPs, and search schemes.
- **🤖 AI Portfolio Analysis** (NEW):
  - Powered by Google Gemini AI.
  - Get diversification scores, risk analysis, and improvement suggestions.
  - Ask custom questions about your portfolio.
  - Credit-based system (10 free credits per user).
- **Persistence**: SQLite storage to persist user sessions and AI credits.
- **Security**: Environment variable configuration for API secrets.
- **GitHub Pages Login**: Hosted login page for easy token extraction.

## 📋 Prerequisites

- **Node.js**: v16 or higher.
- **Zerodha Kite Connect App**: You need a Kite Connect developer account.
  - Create an app to get `API_KEY` and `API_SECRET`.
  - Set the **Redirect URL** (see below).
- **Telegram Bot**: Create a bot via [@BotFather](https://t.me/BotFather) to get the `BOT_TOKEN`.
- **Google Gemini API Key** (Optional): For AI analysis features.
  - Get your key from [Google AI Studio](https://aistudio.google.com/apikey).

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

3. **Deploy Login Page (GitHub Pages)**
   - Go to `pages/index.html`.
   - Edit the file and update `const BOT_USERNAME = 'your_bot_username';` with your actual Telegram bot username.
   - Commit and push your code to GitHub.
   - Go to Repo Settings -> Pages -> Deploy from branch (e.g., `main` or `master`) -> Folder `/pages` (if possible) or just root if you restructure. 
   - *Alternative:* Push just the contents of `pages/` to a `gh-pages` branch.
   - Get your GitHub Pages URL (e.g., `https://youruser.github.io/tg-kite/pages/`).

4. **Configure Environment Variables**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your credentials:
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   KITE_API_KEY=your_kite_api_key
   KITE_API_SECRET=your_kite_api_secret
   KITE_REDIRECT_URL=https://youruser.github.io/tg-kite/pages/
   DB_FILE=kite_bot.db

   # AI Analysis (optional)
   GEMINI_API_KEY=your_google_gemini_api_key
   GEMINI_MODEL=gemini-2.0-flash
   ```
   > **Important**: Go to your Zerodha Developer Console and update the **Redirect URL** to match `KITE_REDIRECT_URL` exactly.

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
   - You will be redirected to your GitHub Page.
   - Click **Copy Token** and then **Return to Bot**.
   - Paste the token into the Telegram chat.

## 🤖 Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and instructions |
| `/login` | Generate Kite login link |
| `/logout` | Clear local session data |
| `/help` | List available commands |

### Portfolio & Trading

| Command | Description |
|---------|-------------|
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

### 📊 Mutual Fund Commands

| Command | Description |
|---------|-------------|
| `/mfholdings` | View MF holdings with P&L (alias: `/mutualfunds`) |
| `/mforders` | List MF orders (last 7 days) |
| `/mforder <order_id>` | View individual MF order details |
| `/mfsips` | View active and paused SIPs |
| `/mfinstruments <query>` | Search mutual fund schemes |

### 🤖 AI Portfolio Analysis

| Command | Description |
|---------|-------------|
| `/analyze` | Quick AI portfolio summary |
| `/analyze detailed` | Full breakdown with risk & allocation |
| `/analyze credits` | Check your AI credits balance |
| `/analyze <question>` | Ask any question about your portfolio |

**Example Questions:**
- `/analyze what are my risky holdings?`
- `/analyze how is my portfolio diversified?`
- `/analyze list my top investments`
- `/analyze which sector am I overexposed to?`

**AI Features:**
- 📈 Diversification score (1-10)
- ⚖️ Risk profile assessment
- 💡 Key portfolio insights
- ✨ Improvement suggestions
- 🎫 Credit-based system (10 free credits per user)

> ⚠️ **Disclaimer**: AI analysis is educational only, not investment advice. No buy/sell recommendations are provided.

## 📂 Project Structure

```
tg-kite/
├── pages/               # Static HTML for GitHub Pages Redirect
│   └── index.html
├── src/
│   ├── ai/              # AI analysis modules
│   │   ├── geminiClient.js      # Gemini SDK wrapper
│   │   └── portfolioAnalyzer.js # Portfolio aggregation & analysis
│   ├── bot/
│   │   ├── handlers/    # Command logic (auth, orders, portfolio, analyze)
│   │   └── middleware/  # Auth middleware
│   ├── kite/            # Kite Connect API wrapper
│   ├── storage/         # SQLite database (sessions + AI credits)
│   └── config/          # Environment configuration
├── index.js             # Entry point
├── .env                 # Secrets (gitignored)
└── package.json
```

## 🗄️ Database Tables

| Table | Purpose |
|-------|---------|
| `sessions` | User authentication tokens |
| `ai_credits` | AI analysis credits per user |

## ⚠️ Disclaimer

This software is for educational purposes only. Trading involves financial risk. The developers are not responsible for any financial losses incurred while using this bot. Ensure you test with small quantities before trading with significant capital.

AI-powered analysis is for educational purposes only and does not constitute investment advice.

## 📄 License

ISC
