import { renderTableImage, type TableRow } from '../../chart/tableImage';
import { BotContext, NextFn } from '../../types/bot';
import type { HoldingRecord, MarginsResponse, PositionRecord, PositionsResponse } from '../../types/kite';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
};

const formatCurrencyNumber = (value: number) => {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const holdingMetrics = (holding: HoldingRecord) => {
    const investedValue = (holding.average_price || 0) * ((holding.realised_quantity || 0) + (holding.t1_quantity || 0));
    const currentValue = (holding.last_price || 0) * ((holding.realised_quantity || 0) + (holding.t1_quantity || 0));
    const pnl = currentValue - investedValue;
    const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
    return { holding, investedValue, currentValue, pnl, pnlPercent };
};

const holdings = async (ctx: BotContext) => {
    try {
        if (!ctx.kite) {
            throw Error('Kite instance not found');
        }
        await ctx.reply('Fetching holdings...');
        const response = (await ctx.kite.getHoldings()) as HoldingRecord[];

        if (!response || response.length === 0) {
            return ctx.reply('You have no holdings currently.');
        }

        const sorted = response.map(holdingMetrics).sort((a, b) => b.pnlPercent - a.pnlPercent);

        let totalInvested = 0;
        let totalCurrent = 0;
        const rows: TableRow[] = sorted.map(({ holding, investedValue, currentValue, pnl, pnlPercent }) => {
            totalInvested += investedValue;
            totalCurrent += currentValue;
            const qty = (holding.quantity || 0) + (holding.t1_quantity || 0);
            return {
                cells: [
                    { key: 'symbol', text: holding.tradingsymbol || 'N/A' },
                    { key: 'qty', text: qty ?? 0 },
                    { key: 'invested', text: formatCurrency(investedValue) },
                    { key: 'current', text: formatCurrency(currentValue) },
                    { key: 'avg', text: formatCurrencyNumber(holding.average_price || 0) },
                    { key: 'ltp', text: formatCurrencyNumber(holding.last_price || 0) },
                    {
                        key: 'pnl',
                        text: `${formatCurrency(pnl)} (${pnl >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`,
                        tone: (pnl > 0 ? 'gain' : pnl < 0 ? 'loss' : 'flat') as 'gain' | 'loss' | 'flat',
                    },
                ],
            };
        });
        const totalPnL = totalCurrent - totalInvested;
        const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
        const buffer = await renderTableImage({
            title: `Portfolio Holdings - ${new Date().toDateString()}`,
            subtitle: 'Current equity holdings snapshot',
            columns: [
                { key: 'symbol', label: 'Instrument', offset: 16, emphasis: true, trim: 24 },
                { key: 'qty', label: 'Qty', offset: 417, align: 'right', emphasis: true },
                { key: 'invested', label: 'Invested', offset: 630, align: 'right', emphasis: true },
                { key: 'current', label: 'Current', offset: 842, align: 'right', emphasis: true },
                { key: 'avg', label: 'Avg', offset: 1055, align: 'right', emphasis: true },
                { key: 'ltp', label: 'LTP', offset: 1267, align: 'right', emphasis: true },
                { key: 'pnl', label: 'P&L', offset: 1480, align: 'right', emphasis: true },
            ],
            rows,
            footerLines: [
                `Total Holdings: ${response.length}`,
                `Total invested: ${formatCurrency(totalInvested)}`,
                `Total current: ${formatCurrency(totalCurrent)}`,
                `Total P&L: ${formatCurrency(totalPnL)} (${totalPnL >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%)`,
            ],
        });

        return await ctx.replyWithPhoto(
            { source: buffer, filename: 'holdings.png' },
            {
                caption: 'Portfolio holdings snapshot',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '📦 Orders', callback_data: 'orders' },
                            { text: '📊 Positions', callback_data: 'positions' },
                        ],
                    ],
                },
            },
        );
    } catch (err: any) {
        return await ctx.reply(`Error fetching holdings: ${err.message}`);
    }
};

const positions = async (ctx: BotContext) => {
    try {
        if (!ctx.kite) {
            throw Error('Kite instance not found');
        }
        ctx.reply('Fetching positions...');
        const response = (await ctx.kite.getPositions()) as PositionsResponse;
        const net = response.net;

        if (!net || net.length === 0) {
            return await ctx.reply('No open positions.');
        }

        let message = '📊 *Net Positions*\n\n';

        net.forEach((position: PositionRecord) => {
            const pnl = position.pnl;
            const emoji = pnl >= 0 ? '📈' : '📉';

            message += `*${position.tradingsymbol}* (${position.product})\n`;
            message += `Qty: ${position.quantity} | Avg: ${position.average_price.toFixed(2)}\n`;
            message += `P&L: ${emoji} ${formatCurrency(pnl)}\n\n`;
        });

        return await ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '📈 Stocks Holdings', callback_data: 'holdings' }]],
            },
        });
    } catch (err: any) {
        return await ctx.reply(`❌ Error fetching positions: ${err.message}`);
    }
};

const balance = async (ctx: BotContext) => {
    try {
        if (!ctx.kite) {
            throw Error('Kite instance not found');
        }
        const margins = (await ctx.kite.getMargins()) as MarginsResponse;
        const eq = margins.equity;
        const cm = margins.commodity;

        let message = '💰 *Account Balance*\n\n';

        if (eq) {
            message += '*Equity*\n';
            message += `Available Cash: ${formatCurrency(eq.available.cash)}\n`;
            message += `Utilized: ${formatCurrency(eq.utilised.debits)}\n`;
            message += `Net: ${formatCurrency(eq.net)}\n\n`;
        }

        if (cm) {
            message += '*Commodity*\n';
            message += `Available Cash: ${formatCurrency(cm.available.cash)}\n`;
            message += `Net: ${formatCurrency(cm.net)}\n`;
        }

        return await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err: any) {
        return await ctx.reply(`❌ Error fetching balance: ${err.message}`);
    }
};

export = {
    holdings,
    positions,
    balance,
};
