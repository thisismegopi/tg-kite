const formatCurrency = val => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
};

const holdings = async ctx => {
    try {
        ctx.reply('Fetching holdings...');
        const response = await ctx.kite.getHoldings();

        if (!response || response.length === 0) {
            return ctx.reply('You have no holdings currently.');
        }

        // holdings is an array
        let message = '📊 *Portfolio Holdings*\n\n';
        let totalPnL = 0;

        response.forEach(h => {
            const pnl = h.pnl;
            totalPnL += pnl;
            const emoji = pnl >= 0 ? '🟢' : '🔴';

            message += `*${h.tradingsymbol}*\n`;
            message += `Qty: ${h.quantity} | Avg: ${h.average_price.toFixed(2)}\n`;
            message += `LTP: ${h.last_price} | P&L: ${emoji} ${formatCurrency(pnl)}\n\n`;
        });

        message += `-------------------\n`;
        message += `*Total P&L: ${totalPnL >= 0 ? '🟢' : '🔴'} ${formatCurrency(totalPnL)}*`;

        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
        ctx.reply(`❌ Error fetching holdings: ${err.message}`);
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
