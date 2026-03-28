/**
 * Mutual Funds Command Handlers
 *
 * Telegram command handlers for Mutual Fund operations.
 * Commands: /mfholdings, /mforders, /mforder, /mfsips, /mfinstruments
 */

const mfCache = require('../../storage/mfCache');
const { renderTableImage } = require('../../chart/tableImage');

const formatCurrency = val => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
};

const formatCurrencyNumber = val => {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
};

const formatDate = dateStr => {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

const mfHoldings = async ctx => {
    try {
        ctx.reply('Fetching mutual fund holdings...');
        const holdings = await ctx.kite.getMfHoldings();

        if (!holdings || holdings.length === 0) {
            return ctx.reply('You have no mutual fund holdings currently.');
        }

        let totalInvested = 0;
        let totalCurrent = 0;

        const rows = holdings.map(holding => {
            const investedValue = (holding.average_price || 0) * (holding.quantity || 0);
            const currentValue = (holding.last_price || 0) * (holding.quantity || 0);
            const pnl = currentValue - investedValue;
            const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

            totalInvested += investedValue;
            totalCurrent += currentValue;

            return {
                cells: [
                    { key: 'fund', text: holding.fund || 'N/A' },
                    { key: 'units', text: formatCurrencyNumber(holding.quantity || 0) },
                    { key: 'invested', text: formatCurrency(investedValue) },
                    { key: 'current', text: formatCurrency(currentValue) },
                    { key: 'avg', text: formatCurrencyNumber(holding.average_price || 0) },
                    { key: 'nav', text: formatCurrencyNumber(holding.last_price || 0) },
                    {
                        key: 'pnl',
                        text: formatCurrency(pnl) + ' (' + (pnl >= 0 ? '+' : '') + pnlPercent.toFixed(2) + '%)',
                        tone: pnl > 0 ? 'gain' : pnl < 0 ? 'loss' : 'flat',
                    },
                ],
            };
        });

        const totalPnL = totalCurrent - totalInvested;
        const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

        const buffer = await renderTableImage({
            title: 'Mutual Fund Holdings',
            subtitle: 'Current mutual fund holdings snapshot',
            columns: [
                { key: 'fund', label: 'Fund', offset: 28, emphasis: true },
                { key: 'units', label: 'Units', offset: 700, align: 'right', emphasis: true },
                { key: 'invested', label: 'Invested', offset: 850, align: 'right', emphasis: true },
                { key: 'current', label: 'Current', offset: 1000, align: 'right', emphasis: true },
                { key: 'avg', label: 'Avg', offset: 1120, align: 'right', emphasis: true },
                { key: 'nav', label: 'NAV', offset: 1220, align: 'right', emphasis: true },
                { key: 'pnl', label: 'P&L', offset: 1450, align: 'right', emphasis: true },
            ],
            rows,
            footerLines: [
                'Total funds: ' + holdings.length,
                'Total invested: ' + formatCurrency(totalInvested),
                'Total current: ' + formatCurrency(totalCurrent),
                'Total P&L: ' + formatCurrency(totalPnL) + ' (' + (totalPnL >= 0 ? '+' : '') + totalPnLPercent.toFixed(2) + '%)',
            ],
        });

        return ctx.replyWithPhoto({ source: buffer, filename: 'mf_holdings.png' }, { caption: 'Mutual fund holdings snapshot' });
    } catch (err) {
        ctx.reply(`Error fetching MF holdings: ${err.message}`);
    }
};

/**
 * /mforders
 * List mutual fund orders from the last 7 days
 */
const mfOrders = async ctx => {
    try {
        ctx.reply('📋 Fetching mutual fund orders...');
        const orders = await ctx.kite.getMfOrders();

        if (!orders || orders.length === 0) {
            return ctx.reply('📭 No mutual fund orders found in the last 7 days.');
        }

        // Show most recent 5 orders
        const recent = orders.slice(0, 5);
        let message = '📋 *Recent MF Orders (Last 7 Days)*\n\n';

        recent.forEach(o => {
            const statusEmoji = o.status === 'COMPLETE' ? '✅' : o.status === 'REJECTED' ? '❌' : o.status === 'OPEN' ? '🔄' : '⏳';

            // Truncate fund name
            const fundName = o.fund.length > 30 ? o.fund.substring(0, 27) + '...' : o.fund;

            message += `${statusEmoji} *${fundName}*\n`;
            message += `🆔 \`${o.order_id}\`\n`;
            message += `Type: ${o.transaction_type} | Amount: ${formatCurrency(o.amount)}\n`;
            if (o.quantity > 0) {
                message += `Units: ${o.quantity.toFixed(3)}\n`;
            }
            message += `Status: *${o.status}*\n`;
            message += `Date: ${formatDate(o.order_timestamp)}\n\n`;
        });

        if (orders.length > 5) {
            message += `\n_Showing 5 of ${orders.length} orders_`;
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
        ctx.reply(`❌ Error fetching MF orders: ${err.message}`);
    }
};

/**
 * /mforder <order_id>
 * Show detailed information about a specific MF order
 */
const mfOrder = async ctx => {
    const parts = ctx.message.text.split(' ');
    const orderId = parts[1];

    if (!orderId) {
        return ctx.reply('⚠️ Usage: /mforder <order_id>\n\nExample: /mforder 271989e0-a64e-4cf3-b4e4-afb8f38dd203');
    }

    try {
        ctx.reply('🔍 Fetching order details...');
        const order = await ctx.kite.getMfOrder(orderId);

        if (!order) {
            return ctx.reply('❌ Order not found.');
        }

        const statusEmoji = order.status === 'COMPLETE' ? '✅' : order.status === 'REJECTED' ? '❌' : order.status === 'OPEN' ? '🔄' : '⏳';

        let message = `📄 *MF Order Details*\n\n`;
        message += `${statusEmoji} Status: *${order.status}*\n`;
        if (order.status_message) {
            message += `Message: ${order.status_message}\n`;
        }
        message += `\n`;
        message += `🆔 Order ID: \`${order.order_id}\`\n`;
        message += `📘 Fund: *${order.fund}*\n`;
        message += `📊 Symbol: \`${order.tradingsymbol}\`\n`;
        message += `\n`;
        message += `💰 Transaction: ${order.transaction_type}\n`;
        message += `💵 Amount: ${formatCurrency(order.amount)}\n`;
        if (order.quantity > 0) {
            message += `📦 Units: ${order.quantity.toFixed(3)}\n`;
        }
        if (order.average_price > 0) {
            message += `📈 Avg NAV: ₹${order.average_price.toFixed(2)}\n`;
        }
        message += `\n`;
        message += `📅 Order Date: ${formatDate(order.order_timestamp)}\n`;
        message += `🏷️ Variety: ${order.variety || 'N/A'}\n`;
        if (order.folio) {
            message += `📁 Folio: \`${order.folio}\`\n`;
        }

        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
        ctx.reply(`❌ Error fetching order details: ${err.message}`);
    }
};

/**
 * /mfsips
 * Show all active and paused SIPs
 */
const mfSips = async ctx => {
    try {
        ctx.reply('📘 Fetching SIP orders...');
        const sips = await ctx.kite.getMfSips();

        if (!sips || sips.length === 0) {
            return ctx.reply('📭 No active SIPs found.');
        }

        let message = '📘 *SIP Orders*\n\n';

        sips.forEach(sip => {
            const statusEmoji = sip.status === 'ACTIVE' ? '✅' : sip.status === 'PAUSED' ? '⏸️' : '⏹️';

            // Truncate fund name
            const fundName = sip.fund.length > 30 ? sip.fund.substring(0, 27) + '...' : sip.fund;

            message += `${statusEmoji} *${fundName}*\n`;
            message += `💵 Amount: ${formatCurrency(sip.instalment_amount)}\n`;
            message += `🔄 Frequency: ${sip.frequency.charAt(0).toUpperCase() + sip.frequency.slice(1)}\n`;
            message += `📅 Next: ${formatDate(sip.next_instalment)}\n`;
            message += `Status: *${sip.status}*\n`;
            message += `✅ Completed: ${sip.completed_instalments} instalments\n`;
            if (sip.pending_instalments > 0 && sip.pending_instalments < 9999) {
                message += `⏳ Pending: ${sip.pending_instalments} instalments\n`;
            }
            message += `\n`;
        });

        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
        ctx.reply(`❌ Error fetching SIPs: ${err.message}`);
    }
};

/**
 * /mfinstruments <search_term>
 * Search mutual fund instruments (cached)
 */
const mfInstruments = async ctx => {
    const parts = ctx.message.text.split(' ');
    const searchTerm = parts.slice(1).join(' ').trim();

    if (!searchTerm) {
        return ctx.reply(
            '🔍 *Search Mutual Funds*\n\n' +
                'Usage: /mfinstruments <search term>\n\n' +
                'Examples:\n' +
                '• /mfinstruments hdfc balanced\n' +
                '• /mfinstruments axis bluechip\n' +
                '• /mfinstruments kotak flexi\n\n' +
                '_This searches fund names, AMCs, and scheme codes._',
            { parse_mode: 'Markdown' },
        );
    }

    try {
        ctx.reply('🔍 Searching mutual funds...');
        const results = await mfCache.searchInstruments(ctx.kite, searchTerm, 10);

        if (!results || results.length === 0) {
            return ctx.reply(`📭 No mutual funds found matching "${searchTerm}".`);
        }

        let message = `🔍 *MF Search Results for "${searchTerm}"*\n\n`;

        results.forEach((inst, idx) => {
            // Truncate name if too long
            const name = inst.name.length > 40 ? inst.name.substring(0, 37) + '...' : inst.name;

            message += `*${idx + 1}. ${name}*\n`;
            message += `📊 Symbol: \`${inst.tradingsymbol}\`\n`;
            message += `🏢 AMC: ${inst.amc.replace('_MF', '')}\n`;
            message += `💰 Min Purchase: ${formatCurrency(inst.minimum_purchase_amount)}\n`;
            message += `📈 Last NAV: ₹${inst.last_price}\n`;
            message += `📋 Type: ${inst.scheme_type} (${inst.plan})\n\n`;
        });

        const cacheStats = mfCache.getCacheStats();
        message += `_Showing ${results.length} of ${cacheStats.instrumentCount} cached funds_`;

        ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
        ctx.reply(`❌ Error searching instruments: ${err.message}`);
    }
};

module.exports = {
    mfHoldings,
    mfOrders,
    mfOrder,
    mfSips,
    mfInstruments,
};
