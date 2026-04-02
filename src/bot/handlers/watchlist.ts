import type { QuoteData, QuoteMap } from '../../types/kite';

import { BotContext } from '../../types/bot';
import db from '../../storage/db';
import marketQuoteHandlers from './marketQuotes';
import { renderTableImage } from '../../chart/tableImage';

const { extractInstruments } = marketQuoteHandlers;

const formatCurrency = (value: unknown) => {
    if (typeof value !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

const formatPercent = (value: unknown) => {
    if (typeof value !== 'number') return 'N/A';
    return `${value.toFixed(2)}%`;
};

function getDayChangeData(quote?: QuoteData | null) {
    const lastPrice = quote?.last_price;
    const prevClose = quote?.ohlc?.close;

    if (typeof lastPrice !== 'number' || typeof prevClose !== 'number' || prevClose === 0) {
        return null;
    }

    const change = lastPrice - prevClose;
    const percent = (change / prevClose) * 100;
    return { change, percent };
}

function formatWatchlistItem(instrument: string, quote?: QuoteData) {
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

    return `*${instrument}*\nLTP: ${lastPrice}\nDay: ${direction} ${signedChange} (${signedPercent})`;
}

function buildWatchlistRows(instruments: string[], quoteMap: QuoteMap) {
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

function getWatchlistUsage(commandName: string) {
    return `Usage: /${commandName} <instrument> [more_instruments]\n\nExamples:\n/${commandName} INFY\n/${commandName} NSE:INFY, BSE:TCS\n/${commandName} "NIFTY 50"`;
}

async function add(ctx: BotContext) {
    try {
        if (!ctx.kite || !ctx.from) {
            throw Error('Kite instance not found');
        }
        const msg = ctx.message;
        if (!msg || !('text' in msg) || typeof msg.text !== 'string') {
            throw Error('Kite instance not found');
        }
        const instruments = extractInstruments(msg.text);

        if (instruments.length === 0) {
            return await ctx.reply(getWatchlistUsage('watchadd'));
        }

        const added = db.addWatchlistInstruments(ctx.from.id, instruments);
        const skipped = instruments.length - added;

        let message = `Saved ${added} instrument(s) to your watchlist.`;
        if (skipped > 0) {
            message += ` ${skipped} already existed.`;
        }

        return await ctx.reply(message);
    } catch (err: any) {
        return await ctx.reply(`Error updating watchlist: ${err.message}`);
    }
}

async function remove(ctx: BotContext) {
    try {
        if (!ctx.kite || !ctx.from) {
            throw Error('Kite instance not found');
        }
        const msg = ctx.message;
        if (!msg || !('text' in msg) || typeof msg.text !== 'string') {
            throw Error('Kite instance not found');
        }
        const instruments = extractInstruments(msg.text);

        if (instruments.length === 0) {
            return await ctx.reply(getWatchlistUsage('watchremove'));
        }
        const removed = db.removeWatchlistInstruments(ctx.from.id, instruments);
        const missing = instruments.length - removed;

        let message = `Removed ${removed} instrument(s) from your watchlist.`;
        if (missing > 0) {
            message += ` ${missing} were not present.`;
        }

        return await ctx.reply(message);
    } catch (err: any) {
        return await ctx.reply(`Error updating watchlist: ${err.message}`);
    }
}

async function list(ctx: BotContext) {
    try {
        if (!ctx.kite || !ctx.from) {
            throw Error('Kite instance not found');
        }
        const entries = db.getWatchlistInstruments(ctx.from.id);

        if (entries.length === 0) {
            return await ctx.reply('Your watchlist is empty.\n\nUse /watchadd <instrument> to save instruments for quick access.');
        }

        const instruments = entries.map((entry: { instrument: string }) => entry.instrument);
        const quoteMap = (await ctx.kite.getQuote(instruments)) as QuoteMap;
        const sortedRows = buildWatchlistRows(instruments, quoteMap);
        const rowsWithData = sortedRows.filter(row => row.hasData);

        if (rowsWithData.length === 0) {
            let message = '*Your Watchlist*\n\n';
            message += instruments.map(instrument => formatWatchlistItem(instrument, quoteMap[instrument])).join('\n\n');

            return await ctx.reply(message, { parse_mode: 'Markdown' });
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

        return await ctx.replyWithPhoto({ source: buffer, filename: 'watchlist.png' }, { caption: 'Watchlist sorted by day gainers to losers' });
    } catch (err: any) {
        return await ctx.reply(`Error loading watchlist: ${err.message}`);
    }
}

async function getInstrument(ctx: BotContext) {
    try {
        if (!ctx.kite || !ctx.from) {
            throw Error('Kite instance not found');
        }
        const msg = ctx.message;
        if (!msg || !('text' in msg) || typeof msg.text !== 'string') {
            throw Error('Kite instance not found');
        }
        const parts = (msg.text ?? '').trim().split(/\s+/);
        const exchange = parts[1] ? String(parts[1]).toUpperCase() : undefined;
        await ctx.reply('Fetching instruments CSV from Kite (large file; may take a moment)…');
        const csv = await ctx.kite.getInstruments(exchange);
        const buf = Buffer.from(csv, 'utf-8');
        const suffix = exchange ? `_${exchange}` : '_all';
        const filename = `instruments${suffix}.csv`;
        return await ctx.replyWithDocument(
            { source: buf, filename },
            {
                caption: 'Kite instruments master list (CSV). Dump is generated once daily; last_price is not real time.' + (exchange ? ` Exchange filter: ${exchange}.` : ' All exchanges.'),
            },
        );
    } catch (err: any) {
        return await ctx.reply(`Error fetching instruments: ${err.message}`);
    }
}

export = {
    add,
    remove,
    list,
    getInstrument,
};
