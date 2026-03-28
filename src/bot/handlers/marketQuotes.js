const formatCurrency = val => {
    if (typeof val !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
};

function extractInstruments(text) {
    const input = text.trim().replace(/^\/\S+\s*/, '');
    if (!input) {
        return [];
    }

    const quotedMatches = [...input.matchAll(/"([^"]+)"|'([^']+)'/g)]
        .map(match => match[1] || match[2])
        .filter(Boolean);

    if (quotedMatches.length > 0) {
        return quotedMatches.map(token => normalizeInstrument(token)).filter(Boolean);
    }

    if (input.includes(',')) {
        return input
            .split(',')
            .map(token => normalizeInstrument(token))
            .filter(Boolean);
    }

    return input
        .split(/\s+/)
        .map(token => normalizeInstrument(token))
        .filter(Boolean);
}

function normalizeInstrument(token) {
    let decoded = token.trim().replace(/\+/g, ' ');
    try {
        decoded = decodeURIComponent(decoded);
    } catch {
        decoded = decoded;
    }

    const cleaned = decoded.toUpperCase();
    if (!cleaned) return null;

    if (cleaned.includes(':')) {
        const [exchange, ...symbolParts] = cleaned.split(':');
        const symbol = symbolParts.join(':');
        if (!exchange || !symbol) return null;
        return `${exchange}:${symbol}`;
    }

    return `NSE:${cleaned}`;
}

function getMissingInstruments(requested, responseMap) {
    return requested.filter(instrument => !responseMap[instrument]);
}

function getInstrumentUsage(commandName) {
    return (
        `Usage: /${commandName} <instrument> [more_instruments]\n\n` +
        `Examples:\n` +
        `/${commandName} NSE:INFY\n` +
        `/${commandName} INFY\n` +
        `/${commandName} NSE:INFY BSE:INFY`
    );
}

function formatQuoteMessage(instrument, quote) {
    const ohlc = quote.ohlc || {};
    let message = `*${instrument}*\n`;
    message += `LTP: ${formatCurrency(quote.last_price)}\n`;
    message += `Open: ${formatCurrency(ohlc.open)} | High: ${formatCurrency(ohlc.high)}\n`;
    message += `Low: ${formatCurrency(ohlc.low)} | Prev Close: ${formatCurrency(ohlc.close)}\n`;
    message += `Volume: ${quote.volume ?? 'N/A'} | Avg Price: ${formatCurrency(quote.average_price)}\n`;
    message += `Buy Qty: ${quote.buy_quantity ?? 'N/A'} | Sell Qty: ${quote.sell_quantity ?? 'N/A'}`;

    if (typeof quote.net_change === 'number') {
        const sign = quote.net_change >= 0 ? '+' : '';
        message += `\nNet Change: ${sign}${formatCurrency(quote.net_change)}`;
    }

    return message;
}

function formatOhlcMessage(instrument, quote) {
    const ohlc = quote.ohlc || {};
    return (
        `*${instrument}*\n` +
        `LTP: ${formatCurrency(quote.last_price)}\n` +
        `Open: ${formatCurrency(ohlc.open)}\n` +
        `High: ${formatCurrency(ohlc.high)}\n` +
        `Low: ${formatCurrency(ohlc.low)}\n` +
        `Prev Close: ${formatCurrency(ohlc.close)}`
    );
}

function formatLtpMessage(instrument, quote) {
    return `*${instrument}*\nLTP: ${formatCurrency(quote.last_price)}`;
}

async function replyForQuotes(ctx, title, requestedInstruments, responseMap, formatter) {
    const available = requestedInstruments.filter(instrument => responseMap[instrument]);
    const missing = getMissingInstruments(requestedInstruments, responseMap);

    if (available.length === 0) {
        return ctx.reply('No market data found for the requested instrument(s).');
    }

    let message = `*${title}*\n\n`;
    message += available.map(instrument => formatter(instrument, responseMap[instrument])).join('\n\n');

    if (missing.length > 0) {
        message += `\n\n_Missing data for: ${missing.join(', ')}_`;
    }

    return ctx.reply(message, { parse_mode: 'Markdown' });
}

const quote = async ctx => {
    const instruments = extractInstruments(ctx.message.text);
    if (instruments.length === 0) {
        return ctx.reply(getInstrumentUsage('quote'));
    }

    try {
        await ctx.reply('Fetching market quote...');
        const response = await ctx.kite.getQuote(instruments);
        return replyForQuotes(ctx, 'Market Quote', instruments, response || {}, formatQuoteMessage);
    } catch (err) {
        return ctx.reply(`Error fetching quote: ${err.message}`);
    }
};

const ohlc = async ctx => {
    const instruments = extractInstruments(ctx.message.text);
    if (instruments.length === 0) {
        return ctx.reply(getInstrumentUsage('ohlc'));
    }

    try {
        await ctx.reply('Fetching OHLC...');
        const response = await ctx.kite.getOhlc(instruments);
        return replyForQuotes(ctx, 'OHLC', instruments, response || {}, formatOhlcMessage);
    } catch (err) {
        return ctx.reply(`Error fetching OHLC: ${err.message}`);
    }
};

const ltp = async ctx => {
    const instruments = extractInstruments(ctx.message.text);
    if (instruments.length === 0) {
        return ctx.reply(getInstrumentUsage('ltp'));
    }

    try {
        await ctx.reply('Fetching LTP...');
        const response = await ctx.kite.getLtp(instruments);
        return replyForQuotes(ctx, 'LTP', instruments, response || {}, formatLtpMessage);
    } catch (err) {
        return ctx.reply(`Error fetching LTP: ${err.message}`);
    }
};

module.exports = {
    quote,
    ohlc,
    ltp,
    extractInstruments,
    normalizeInstrument
};
