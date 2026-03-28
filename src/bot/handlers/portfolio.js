const { renderTableImage } = require('../../chart/tableImage');

const formatCurrency = val => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
};

const formatCurrencyNumber = val => {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
};

const holdings = async ctx => {
    try {
        ctx.reply('Fetching holdings...');
        const response = await ctx.kite.getHoldings();

        if (!response || response.length === 0) {
            return ctx.reply('You have no holdings currently.');
        }

        const totalPnL = response.reduce((sum, holding) => sum + (holding.pnl || 0), 0);
        const rows = response
            .sort((a, b) => b.pnl - a.pnl)
            .map(holding => ({
                cells: [
                    { key: 'symbol', text: holding.tradingsymbol || 'N/A' },
                    { key: 'qty', text: holding.quantity ?? 0 },
                    { key: 'avg', text: formatCurrencyNumber(holding.average_price || 0) },
                    { key: 'ltp', text: formatCurrencyNumber(holding.last_price || 0) },
                    {
                        key: 'pnl',
                        text: formatCurrency(holding.pnl || 0),
                        tone: (holding.pnl || 0) > 0 ? 'gain' : (holding.pnl || 0) < 0 ? 'loss' : 'flat',
                    },
                ],
            }));

        const buffer = await renderTableImage({
            title: 'Portfolio Holdings',
            subtitle: 'Current equity holdings snapshot',
            columns: [
                { key: 'symbol', label: 'Instrument', offset: 28, emphasis: true, trim: 24 },
                { key: 'qty', label: 'Qty', offset: 700, align: 'right', emphasis: true },
                { key: 'avg', label: 'Avg', offset: 900, align: 'right', emphasis: true },
                { key: 'ltp', label: 'LTP', offset: 1130, align: 'right', emphasis: true },
                { key: 'pnl', label: 'P&L', offset: 1410, align: 'right', emphasis: true },
            ],
            rows,
            footerLines: ['Total holdings: ' + response.length, 'Total P&L: ' + formatCurrency(totalPnL)],
        });

        return ctx.replyWithPhoto({ source: buffer, filename: 'holdings.png' }, { caption: 'Portfolio holdings snapshot' });
    } catch (err) {
        ctx.reply(`Error fetching holdings: ${err.message}`);
    }
};

const positions = async ctx => {
    try {
        ctx.reply('Fetching positions...');
        const response = await ctx.kite.getPositions();
        const net = response.net; // Array of net positions

        if (!net || net.length === 0) {
            return ctx.reply('No open positions.');
        }

        let message = '📉 *Net Positions*\n\n';

        net.forEach(p => {
            const pnl = p.pnl;
            const emoji = pnl >= 0 ? '🟢' : '🔴';

            message += `*${p.tradingsymbol}* (${p.product})\n`;
            message += `Qty: ${p.quantity} | Avg: ${p.average_price.toFixed(2)}\n`;
            message += `P&L: ${emoji} ${formatCurrency(pnl)}\n\n`;
        });

        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
        ctx.reply(`❌ Error fetching positions: ${err.message}`);
    }
};

const balance = async ctx => {
    try {
        const margins = await ctx.kite.getMargins();
        // margins = { equity: { enabled, net, available, ... }, commodity: { ... } }

        const eq = margins.equity;
        const cm = margins.commodity;

        let message = '💰 *Account Balance*\n\n';

        if (eq) {
            message += `*Equity*\n`;
            message += `Available Cash: ${formatCurrency(eq.available.cash)}\n`;
            message += `Utilized: ${formatCurrency(eq.utilised.debits)}\n`;
            message += `Net: ${formatCurrency(eq.net)}\n\n`;
        }

        if (cm) {
            message += `*Commodity*\n`;
            message += `Available Cash: ${formatCurrency(cm.available.cash)}\n`;
            message += `Net: ${formatCurrency(cm.net)}\n`;
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
        ctx.reply(`❌ Error fetching balance: ${err.message}`);
    }
};

module.exports = {
    holdings,
    positions,
    balance,
};
