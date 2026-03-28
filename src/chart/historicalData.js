const { renderCandlestickChart } = require('./candlestickChart');

const TIMEFRAME_MAP = {
    '1m': { mode: 'direct', interval: 'minute', lookbackDays: 7, label: '1m' },
    '3m': { mode: 'direct', interval: '3minute', lookbackDays: 14, label: '3m' },
    '5m': { mode: 'direct', interval: '5minute', lookbackDays: 21, label: '5m' },
    '30m': { mode: 'direct', interval: '30minute', lookbackDays: 90, label: '30m' },
    '1h': { mode: 'direct', interval: '60minute', lookbackDays: 180, label: '1h' },
    '1d': { mode: 'direct', interval: 'day', lookbackDays: 220, label: '1d' },
    '1w': { mode: 'aggregate', sourceInterval: 'day', lookbackDays: 900, bucket: 'week', label: '1w' },
    '1M': { mode: 'aggregate', sourceInterval: 'day', lookbackDays: 4200, bucket: 'month', label: '1M' },
    '12M': { mode: 'aggregate', sourceInterval: 'day', lookbackDays: 36500, bucket: 'year', label: '12M' }
};

function pad(value) {
    return String(value).padStart(2, '0');
}

function formatDateTime(date) {
    return [
        date.getFullYear(),
        '-',
        pad(date.getMonth() + 1),
        '-',
        pad(date.getDate()),
        ' ',
        pad(date.getHours()),
        ':',
        pad(date.getMinutes()),
        ':',
        pad(date.getSeconds())
    ].join('');
}

function parseCandle(row) {
    return {
        timestamp: new Date(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5] || 0),
        oi: row[6] !== undefined ? Number(row[6]) : null
    };
}

function weekKey(date) {
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
    return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function yearKey(date) {
    return `${date.getFullYear()}`;
}

function aggregateCandles(candles, bucket) {
    const keyFn = bucket === 'week' ? weekKey : bucket === 'month' ? monthKey : yearKey;
    const grouped = [];
    let current = null;

    candles.forEach(candle => {
        const key = keyFn(candle.timestamp);

        if (!current || current.key !== key) {
            current = {
                key,
                timestamp: candle.timestamp,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume || 0,
                oi: candle.oi
            };
            grouped.push(current);
            return;
        }

        current.high = Math.max(current.high, candle.high);
        current.low = Math.min(current.low, candle.low);
        current.close = candle.close;
        current.volume += candle.volume || 0;
        current.oi = candle.oi;
    });

    return grouped.map(({ key, ...candle }) => candle);
}

function getTimeframeConfig(timeframe) {
    const config = TIMEFRAME_MAP[timeframe];
    if (!config) {
        throw new Error('Unsupported timeframe. Use 1m, 3m, 5m, 30m, 1h, 1d, 1w, 1M, or 12M.');
    }
    return config;
}

async function resolveInstrumentToken(kiteClient, instrument) {
    const ltpMap = await kiteClient.getLtp([instrument]);
    const quote = ltpMap[instrument];

    if (!quote || !quote.instrument_token) {
        throw new Error(`Unable to resolve instrument token for ${instrument}.`);
    }

    return quote.instrument_token;
}

async function fetchCandles(kiteClient, instrument, timeframe) {
    const config = getTimeframeConfig(timeframe);
    const instrumentToken = await resolveInstrumentToken(kiteClient, instrument);

    const to = new Date();
    const from = new Date(to.getTime() - config.lookbackDays * 24 * 60 * 60 * 1000);

    const sourceInterval = config.mode === 'direct' ? config.interval : config.sourceInterval;
    const response = await kiteClient.getHistoricalData(instrumentToken, sourceInterval, {
        from: formatDateTime(from),
        to: formatDateTime(to),
        oi: 0
    });

    const candles = Array.isArray(response?.candles) ? response.candles.map(parseCandle) : [];
    if (candles.length === 0) {
        throw new Error(`No historical data available for ${instrument} on ${timeframe}.`);
    }

    const processed = config.mode === 'aggregate' ? aggregateCandles(candles, config.bucket) : candles;
    return {
        candles: processed.slice(-100),
        label: config.label
    };
}

async function buildChartImage(kiteClient, instrument, timeframe) {
    const { candles, label } = await fetchCandles(kiteClient, instrument, timeframe);

    if (candles.length === 0) {
        throw new Error(`No candles found for ${instrument} on ${timeframe}.`);
    }

    return await renderCandlestickChart({
        candles,
        instrument,
        intervalLabel: label
    });
}

module.exports = {
    buildChartImage,
    fetchCandles,
    getTimeframeConfig
};
