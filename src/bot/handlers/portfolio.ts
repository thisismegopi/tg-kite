import { renderTableImage, type TableRow } from "../../chart/tableImage";
import type { HoldingRecord, MarginsResponse, PositionRecord, PositionsResponse } from "../../types/kite";

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
};

const formatCurrencyNumber = (value: number) => {
    return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const holdings = async (ctx: any) => {
    try {
        ctx.reply("Fetching holdings...");
        const response = await ctx.kite.getHoldings() as HoldingRecord[];

        if (!response || response.length === 0) {
            return ctx.reply("You have no holdings currently.");
        }

        const totalPnL = response.reduce((sum, holding) => sum + (holding.pnl || 0), 0);
        const rows: TableRow[] = response
            .sort((left, right) => (right.pnl || 0) - (left.pnl || 0))
            .map(holding => ({
                cells: [
                    { key: "symbol", text: holding.tradingsymbol || "N/A" },
                    { key: "qty", text: holding.quantity ?? 0 },
                    { key: "avg", text: formatCurrencyNumber(holding.average_price || 0) },
                    { key: "ltp", text: formatCurrencyNumber(holding.last_price || 0) },
                    {
                        key: "pnl",
                        text: formatCurrency(holding.pnl || 0),
                        tone: ((holding.pnl || 0) > 0 ? "gain" : (holding.pnl || 0) < 0 ? "loss" : "flat") as "gain" | "loss" | "flat",
                    },
                ],
            }));

        const buffer = await renderTableImage({
            title: "Portfolio Holdings",
            subtitle: "Current equity holdings snapshot",
            columns: [
                { key: "symbol", label: "Instrument", offset: 28, emphasis: true, trim: 24 },
                { key: "qty", label: "Qty", offset: 700, align: "right", emphasis: true },
                { key: "avg", label: "Avg", offset: 900, align: "right", emphasis: true },
                { key: "ltp", label: "LTP", offset: 1130, align: "right", emphasis: true },
                { key: "pnl", label: "P&L", offset: 1410, align: "right", emphasis: true },
            ],
            rows,
            footerLines: [`Total holdings: ${response.length}`, `Total P&L: ${formatCurrency(totalPnL)}`],
        });

        return ctx.replyWithPhoto({ source: buffer, filename: "holdings.png" }, { caption: "Portfolio holdings snapshot" });
    } catch (err: any) {
        ctx.reply(`Error fetching holdings: ${err.message}`);
    }
};

const positions = async (ctx: any) => {
    try {
        ctx.reply("Fetching positions...");
        const response = await ctx.kite.getPositions() as PositionsResponse;
        const net = response.net;

        if (!net || net.length === 0) {
            return ctx.reply("No open positions.");
        }

        let message = '📊 *Net Positions*\n\n';

        net.forEach((position: PositionRecord) => {
            const pnl = position.pnl;
            const emoji = pnl >= 0 ? "📈" : "📉";

            message += `*${position.tradingsymbol}* (${position.product})\n`;
            message += `Qty: ${position.quantity} | Avg: ${position.average_price.toFixed(2)}\n`;
            message += `P&L: ${emoji} ${formatCurrency(pnl)}\n\n`;
        });

        ctx.reply(message, { parse_mode: "Markdown" });
    } catch (err: any) {
        ctx.reply(`❌ Error fetching positions: ${err.message}`);
    }
};

const balance = async (ctx: any) => {
    try {
        const margins = await ctx.kite.getMargins() as MarginsResponse;
        const eq = margins.equity;
        const cm = margins.commodity;

        let message = "💰 *Account Balance*\n\n";

        if (eq) {
            message += "*Equity*\n";
            message += `Available Cash: ${formatCurrency(eq.available.cash)}\n`;
            message += `Utilized: ${formatCurrency(eq.utilised.debits)}\n`;
            message += `Net: ${formatCurrency(eq.net)}\n\n`;
        }

        if (cm) {
            message += "*Commodity*\n";
            message += `Available Cash: ${formatCurrency(cm.available.cash)}\n`;
            message += `Net: ${formatCurrency(cm.net)}\n`;
        }

        ctx.reply(message, { parse_mode: "Markdown" });
    } catch (err: any) {
        ctx.reply(`❌ Error fetching balance: ${err.message}`);
    }
};

export = {
    holdings,
    positions,
    balance,
};
