const { buildChartImage } = require('../../chart/historicalData');
const { normalizeInstrument } = require('./marketQuotes');

function getUsage() {
    return (
        'Usage: /chart <instrument> <timeframe>\n\n' +
        'Supported timeframes: 1m, 3m, 5m, 30m, 1h, 1d, 1w, 1M, 12M\n\n' +
        'Examples:\n' +
        '/chart NSE:INFY 5m\n' +
        '/chart INFY 1d\n' +
        '/chart BSE:SENSEX 1w'
    );
}

function parseChartCommand(text) {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 3) {
        return null;
    }

    const timeframe = parts[parts.length - 1];
    const instrumentText = parts.slice(1, -1).join(' ');
    const instrument = normalizeInstrument(instrumentText);

    if (!instrument || !timeframe) {
        return null;
    }

    return { instrument, timeframe };
}

const chart = async ctx => {
    const parsed = parseChartCommand(ctx.message.text);
    if (!parsed) {
        return ctx.reply(getUsage());
    }

    try {
        await ctx.reply(`Generating chart for ${parsed.instrument} (${parsed.timeframe})...`);
        const image = await buildChartImage(ctx.kite, parsed.instrument, parsed.timeframe);

        return ctx.replyWithPhoto(
            { source: image.buffer, filename: `${parsed.instrument.replace(':', '_')}_${parsed.timeframe}.png` },
            { caption: image.caption }
        );
    } catch (err) {
        return ctx.reply(`Error generating chart: ${err.message}`);
    }
};

module.exports = {
    chart,
    parseChartCommand
};
