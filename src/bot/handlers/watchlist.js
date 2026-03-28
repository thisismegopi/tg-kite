const db = require('../../storage/db');
const { renderTableImage } = require('../../chart/tableImage');
const { extractInstruments } = require('./marketQuotes');

const formatCurrency = val => {
    if (typeof val !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);
};

const formatPercent = val => {
    if (typeof val !== 'number') return 'N/A';
    return `${val.toFixed(2)}%`;
};

function getDayChangeData(quote) {
    const lastPrice = quote?.last_price;
    const prevClose = quote?.ohlc?.close;

    if (typeof lastPrice !== 'number' || typeof prevClose !== 'number' || prevClose === 0) {
        return null;
    }

    const change = lastPrice - prevClose;
    const percent = (change / prevClose) * 100;
    return { change, percent };
}

function formatWatchlistItem(instrument, quote) {
    if (!quote) {
        return `*${instrument}*\nLTP: N/A\nDay: Data unavailable`;
    }

    const dayChange = getDayChangeData(quote);
    const lastPrice = formatCurrency(quote.last_price);

    if (!dayChange) {
        return `*${instrument}*\nLTP: ${lastPrice}\nDay: Data unavailable`;
    }

    const direction = dayChange.change > 0 ? 'UP' : dayChange.change < 0 ? 'DOWN' : 'FLAT';
    const signedChange = `${dayChange.change >= 0 ? '+' : ''}${formatCurrency(dayChange.change)}`;
    const signedPercent = `${dayChange.percent >= 0 ? '+' : ''}${formatPercent(dayChange.percent)}`;

    return `*${instrument}*\n` + `LTP: ${lastPrice}\n` + `Day: ${direction} ${signedChange} (${signedPercent})`;
}

function buildWatchlistRows(instruments, quoteMap) {
    return instruments
        .map(instrument => {
            const quote = quoteMap[instrument];
            const dayChange = getDayChangeData(quote);

            if (!quote || !dayChange || typeof quote.last_price !== 'number') {
                return {
                    instrument,
                    lastPrice: 0,
                    change: 0,
                    percent: Number.NEGATIVE_INFINITY,
                    hasData: false,
                };
            }

            return {
                instrument,
                lastPrice: quote.last_price,
                change: dayChange.change,
                percent: dayChange.percent,
                hasData: true,
            };
        })
        .sort((left, right) => {
            if (left.hasData !== right.hasData) {
                return left.hasData ? -1 : 1;
            }

            if (right.percent !== left.percent) {
                return right.percent - left.percent;
            }

            return left.instrument.localeCompare(right.instrument);
        });
}

function getWatchlistUsage(commandName) {
    return `Usage: /${commandName} <instrument> [more_instruments]\n\n` + 'Examples:\n' + `/${commandName} INFY\n` + `/${commandName} NSE:INFY, BSE:TCS\n` + `/${commandName} "NIFTY 50"`;
}

async function add(ctx) {
    const instruments = extractInstruments(ctx.message.text);

    if (instruments.length === 0) {
        return ctx.reply(getWatchlistUsage('watchadd'));
    }

    try {
        const added = db.addWatchlistInstruments(ctx.from.id, instruments);
        const skipped = instruments.length - added;

        let message = `Saved ${added} instrument(s) to your watchlist.`;
        if (skipped > 0) {
            message += ` ${skipped} already existed.`;
        }

        return ctx.reply(message);
    } catch (err) {
        return ctx.reply(`Error updating watchlist: ${err.message}`);
    }
}

async function remove(ctx) {
    const instruments = extractInstruments(ctx.message.text);

    if (instruments.length === 0) {
        return ctx.reply(getWatchlistUsage('watchremove'));
    }

    try {
        const removed = db.removeWatchlistInstruments(ctx.from.id, instruments);
        const missing = instruments.length - removed;

        let message = `Removed ${removed} instrument(s) from your watchlist.`;
        if (missing > 0) {
            message += ` ${missing} were not present.`;
        }

        return ctx.reply(message);
    } catch (err) {
        return ctx.reply(`Error updating watchlist: ${err.message}`);
    }
}

async function list(ctx) {
    try {
        const entries = db.getWatchlistInstruments(ctx.from.id);

        if (entries.length === 0) {
            return ctx.reply('Your watchlist is empty.\n\nUse /watchadd <instrument> to save instruments for quick access.');
        }

        const instruments = entries.map(entry => entry.instrument);
        const quoteMap = await ctx.kite.getQuote(instruments);
        const sortedRows = buildWatchlistRows(instruments, quoteMap);
        const rowsWithData = sortedRows.filter(row => row.hasData);

        if (rowsWithData.length === 0) {
            let message = '*Your Watchlist*\n\n';
            message += instruments.map(instrument => formatWatchlistItem(instrument, quoteMap[instrument])).join('\n\n');

            return ctx.reply(message, { parse_mode: 'Markdown' });
        }

        const buffer = await renderTableImage({
            title: 'Watchlist Snapshot',
            subtitle: 'Sorted by day gainers to losers',
            columns: [
                { key: 'rank', label: '#', offset: 28 },
                { key: 'instrument', label: 'Instrument', offset: 104, emphasis: true, trim: 28 },
                { key: 'ltp', label: 'LTP', offset: 875, align: 'right', emphasis: true },
                { key: 'change', label: 'Change', offset: 1145, align: 'right', emphasis: true },
                { key: 'percent', label: 'Change %', offset: 1410, align: 'right', emphasis: true },
            ],
            rows: rowsWithData.map((row, index) => ({
                cells: [
                    { key: 'rank', text: index + 1, tone: 'flat' },
                    { key: 'instrument', text: row.instrument },
                    { key: 'ltp', text: formatCurrency(row.lastPrice) },
                    {
                        key: 'change',
                        text: `${row.change >= 0 ? '+' : ''}${formatCurrency(row.change)}`,
                        tone: row.percent > 0 ? 'gain' : row.percent < 0 ? 'loss' : 'flat',
                    },
                    {
                        key: 'percent',
                        text: `${row.percent >= 0 ? '+' : ''}${formatPercent(row.percent)}`,
                        tone: row.percent > 0 ? 'gain' : row.percent < 0 ? 'loss' : 'flat',
                    },
                ],
            })),
            footerLines: [`Total ${rowsWithData.length} items`],
        });

        return ctx.replyWithPhoto({ source: buffer, filename: 'watchlist.png' }, { caption: 'Watchlist sorted by day gainers to losers' });
    } catch (err) {
        return ctx.reply(`Error loading watchlist: ${err.message}`);
    }
}

module.exports = {
    add,
    remove,
    list,
};
