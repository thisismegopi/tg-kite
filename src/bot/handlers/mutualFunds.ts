import type { MfHoldingRecord, MfOrderRecord, MfSipRecord } from '../../types/kite';
import { renderTableImage, type TableRow } from '../../chart/tableImage';
import { BotContext } from '../../types/bot';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
};

const formatCurrencyNumber = (value: number) => {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

const mfHoldingMetrics = (holding: MfHoldingRecord) => {
    const investedValue = (holding.average_price || 0) * (holding.quantity || 0);
    const currentValue = (holding.last_price || 0) * (holding.quantity || 0);
    const pnl = currentValue - investedValue;
    const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
    return { holding, investedValue, currentValue, pnl, pnlPercent };
};

const sipStatusPriority = (status?: string) => {
    const normalized = (status || '').toUpperCase();
    if (normalized === 'ACTIVE') return 0;
    if (normalized === 'PAUSED') return 1;
    if (normalized === 'CANCELLED') return 2;
    return 3;
};

const sipStatusTone = (status?: string): 'gain' | 'flat' | 'loss' => {
    const normalized = (status || '').toUpperCase();
    if (normalized === 'ACTIVE') return 'gain';
    if (normalized === 'PAUSED') return 'flat';
    if (normalized === 'CANCELLED') return 'loss';
    return 'loss';
};

const sipNextInstalmentTime = (dateStr?: string) => {
    if (!dateStr) return Number.MAX_SAFE_INTEGER;
    const timestamp = new Date(dateStr).getTime();
    return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
};

const formatFrequency = (frequency?: string) => {
    if (!frequency) return 'N/A';
    return `${frequency.charAt(0).toUpperCase()}${frequency.slice(1)}`;
};

const mfHoldings = async (ctx: BotContext) => {
    try {
        if (!ctx.kite || !ctx.from) {
            throw Error('Kite instance not found');
        }
        await ctx.reply('📥 Fetching mutual fund holdings...');
        const holdings = (await ctx.kite.getMfHoldings()) as MfHoldingRecord[];

        if (!holdings || holdings.length === 0) {
            return await ctx.reply('📭 You have no mutual fund holdings currently.');
        }

        const sorted = holdings.map(mfHoldingMetrics).sort((a, b) => b.pnlPercent - a.pnlPercent);

        let totalInvested = 0;
        let totalCurrent = 0;
        const rows: TableRow[] = sorted.map(({ holding, investedValue, currentValue, pnl, pnlPercent }) => {
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
                        text: `${formatCurrency(pnl)} (${pnl >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`,
                        tone: (pnl > 0 ? 'gain' : pnl < 0 ? 'loss' : 'flat') as 'gain' | 'loss' | 'flat',
                    },
                ],
            };
        });

        const totalPnL = totalCurrent - totalInvested;
        const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

        const buffer = await renderTableImage({
            title: `Mutual Fund Holdings - ${new Date().toDateString()}`,
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
                `Total funds: ${holdings.length}`,
                `Total invested: ${formatCurrency(totalInvested)}`,
                `Total current: ${formatCurrency(totalCurrent)}`,
                `Total P&L: ${formatCurrency(totalPnL)} (${totalPnL >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%)`,
            ],
        });

        return await ctx.replyWithPhoto(
            { source: buffer, filename: 'mf_holdings.png' },
            {
                caption: 'Mutual fund holdings snapshot',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '📦 Orders', callback_data: 'mforders' },
                            { text: '🎯 SIPs', callback_data: 'mfsips' },
                        ],
                    ],
                },
            },
        );
    } catch (err: any) {
        return await ctx.reply(`❌ Error fetching MF holdings: ${err.message}`);
    }
};

const mfOrders = async (ctx: BotContext) => {
    try {
        if (!ctx.kite || !ctx.from) {
            throw Error('Kite instance not found');
        }
        await ctx.reply('📮 Fetching mutual fund orders...');
        const orders = (await ctx.kite.getMfOrders()) as MfOrderRecord[];

        if (!orders || orders.length === 0) {
            return await ctx.reply('📭 No mutual fund orders found in the last 7 days.');
        }

        const recent = orders.slice(0, 5);
        let message = '📆 *Recent MF Orders (Last 7 Days)*\n\n';

        recent.forEach(order => {
            const statusEmoji = order.status === 'COMPLETE' ? '✅' : order.status === 'REJECTED' ? '❌' : order.status === 'OPEN' ? '⌛' : 'ℹ️';
            const fundName = order.fund.length > 30 ? `${order.fund.substring(0, 27)}...` : order.fund;

            message += `${statusEmoji} *${fundName}*\n`;
            message += `🆔 \`${order.order_id}\`\n`;
            message += `📝 Transaction: ${order.transaction_type} | Amount: ${formatCurrency(order.amount)}\n`;
            if (order.quantity > 0) {
                message += `📦 Units: ${order.quantity.toFixed(3)}\n`;
            }
            message += `📊 Status: *${order.status}*\n`;
            message += `📅 Date: ${formatDate(order.order_timestamp)}\n\n`;
        });

        if (orders.length > 5) {
            message += `\n_Showing 5 of ${orders.length} orders_`;
        }

        return await ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '📈 MF Holdings', callback_data: 'mfholdings' }]],
            },
        });
    } catch (err: any) {
        return await ctx.reply(`❌ Error fetching MF orders: ${err.message}`);
    }
};

const mfOrder = async (ctx: BotContext) => {
    try {
        if (!ctx.kite) {
            throw Error('Kite instance not found');
        }
        const msg = ctx.message;
        if (!msg || !('text' in msg) || typeof msg.text !== 'string') {
            throw Error('Kite instance not found');
        }
        const parts = msg.text.split(' ');
        const orderId = parts[1];

        if (!orderId) {
            return await ctx.reply('⚠️ Usage: /mforder <order_id>\n\nExample: /mforder 271989e0-a64e-4cf3-b4e4-afb8f38dd203');
        }

        ctx.reply('🔍 Fetching order details...');
        const order = (await ctx.kite.getMfOrder(orderId)) as MfOrderRecord;

        if (!order) {
            return await ctx.reply('❌ Order not found.');
        }

        let message = '🧾 *MF Order Details*\n\n';
        message += `🆔 Order ID: \`${order.order_id}\`\n`;
        message += `🏦 Fund: *${order.fund}*\n`;
        message += `💠 Symbol: \`${order.tradingsymbol}\`\n\n`;
        message += `📝 Transaction: ${order.transaction_type}\n`;
        message += `💰 Amount: ${formatCurrency(order.amount)}\n`;
        if (order.quantity > 0) {
            message += `📦 Units: ${order.quantity.toFixed(3)}\n`;
        }
        if (order.average_price > 0) {
            message += `📊 Avg NAV: ${order.average_price.toFixed(2)}\n`;
        }
        message += `📅 Order Date: ${formatDate(order.order_timestamp)}\n`;
        message += `🗂️ Variety: ${order.variety || 'N/A'}\n`;
        if (order.folio) {
            message += `🧾 Folio: \`${order.folio}\`\n`;
        }

        return await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err: any) {
        return await ctx.reply(`❌ Error fetching order details: ${err.message}`);
    }
};

const mfSips = async (ctx: BotContext) => {
    try {
        if (!ctx.kite) {
            throw Error('Kite instance not found');
        }
        await ctx.reply('📅 Fetching SIP orders...');
        const sips = (await ctx.kite.getMfSips()) as MfSipRecord[];

        if (!sips || sips.length === 0) {
            return await ctx.reply('📭 No active SIPs found.');
        }

        const sorted = [...sips].sort((a, b) => {
            const statusDiff = sipStatusPriority(a.status) - sipStatusPriority(b.status);
            if (statusDiff !== 0) return statusDiff;

            const nextDiff = sipNextInstalmentTime(a.next_instalment) - sipNextInstalmentTime(b.next_instalment);
            if (nextDiff !== 0) return nextDiff;

            return a.fund.localeCompare(b.fund, 'en', { sensitivity: 'base' });
        });

        let activeCount = 0;
        let pausedCount = 0;
        const rows: TableRow[] = sorted.map(sip => {
            if (sip.status === 'ACTIVE') activeCount += 1;
            if (sip.status === 'PAUSED') pausedCount += 1;

            return {
                cells: [
                    { key: 'fund', text: sip.fund || 'N/A' },
                    { key: 'amount', text: formatCurrency(sip.instalment_amount || 0) },
                    { key: 'frequency', text: formatFrequency(sip.frequency) },
                    { key: 'next', text: formatDate(sip.next_instalment) },
                    { key: 'status', text: sip.status || 'N/A', tone: sipStatusTone(sip.status) },
                    { key: 'completed', text: sip.completed_instalments ?? 0 },
                ],
            };
        });

        const buffer = await renderTableImage({
            title: `Mutual Fund SIPs - ${new Date().toDateString()}`,
            subtitle: 'Current SIP instructions snapshot',
            columns: [
                { key: 'fund', label: 'Fund', offset: 28, emphasis: true },
                { key: 'amount', label: 'Amount', offset: 865, align: 'right', emphasis: true },
                { key: 'frequency', label: 'Frequency', offset: 1035, align: 'right', emphasis: true },
                { key: 'next', label: 'Next', offset: 1195, align: 'right', emphasis: true },
                { key: 'status', label: 'Status', offset: 1330, align: 'right', emphasis: true },
                { key: 'completed', label: 'Completed', offset: 1460, align: 'right', emphasis: true },
            ],
            rows,
            footerLines: [`Total SIPs: ${sips.length}`, `Active SIPs: ${activeCount}`, `Paused SIPs: ${pausedCount}`],
        });

        return await ctx.replyWithPhoto(
            { source: buffer, filename: 'mf_sips.png' },
            {
                caption: 'Mutual fund SIP snapshot',
                reply_markup: {
                    inline_keyboard: [[{ text: '📈 MF Holdings', callback_data: 'mfholdings' }]],
                },
            },
        );
    } catch (err: any) {
        return await ctx.reply(`❌ Error fetching SIPs: ${err.message}`);
    }
};

const mfInstruments = async (ctx: BotContext) => {
    try {
        if (!ctx.kite) {
            throw Error('Kite instance not found');
        }
        await ctx.reply('Fetching mutual fund instruments CSV from Kite (large file; may take a moment)...');
        const csv = await ctx.kite.getMfInstruments();
        const buf = Buffer.from(csv, 'utf-8');
        return await ctx.replyWithDocument(
            { source: buf, filename: 'mf_instruments.csv' },
            {
                caption: 'Kite mutual fund instruments master list (CSV). Dump is generated once daily; last_price is not real time.',
            },
        );
    } catch (err: any) {
        return await ctx.reply(`❌ Error fetching MF instruments: ${err.message}`);
    }
};

export = {
    mfHoldings,
    mfOrders,
    mfOrder,
    mfSips,
    mfInstruments,
};
