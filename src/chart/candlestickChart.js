const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = buildCrcTable();
const FONT = {
    ' ': ['000', '000', '000', '000', '000'],
    '.': ['000', '000', '000', '010', '010'],
    ':': ['000', '010', '000', '010', '000'],
    '-': ['000', '000', '111', '000', '000'],
    '/': ['001', '001', '010', '100', '100'],
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '001', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    'A': ['111', '101', '111', '101', '101'],
    'B': ['110', '101', '110', '101', '110'],
    'C': ['111', '100', '100', '100', '111'],
    'D': ['110', '101', '101', '101', '110'],
    'E': ['111', '100', '110', '100', '111'],
    'F': ['111', '100', '110', '100', '100'],
    'G': ['111', '100', '101', '101', '111'],
    'H': ['101', '101', '111', '101', '101'],
    'I': ['111', '010', '010', '010', '111'],
    'J': ['001', '001', '001', '101', '111'],
    'K': ['101', '101', '110', '101', '101'],
    'L': ['100', '100', '100', '100', '111'],
    'M': ['101', '111', '111', '101', '101'],
    'N': ['101', '111', '111', '111', '101'],
    'O': ['111', '101', '101', '101', '111'],
    'P': ['111', '101', '111', '100', '100'],
    'Q': ['111', '101', '101', '111', '001'],
    'R': ['110', '101', '110', '101', '101'],
    'S': ['111', '100', '111', '001', '111'],
    'T': ['111', '010', '010', '010', '010'],
    'U': ['101', '101', '101', '101', '111'],
    'V': ['101', '101', '101', '101', '010'],
    'W': ['101', '101', '111', '111', '101'],
    'X': ['101', '101', '010', '101', '101'],
    'Y': ['101', '101', '010', '010', '010'],
    'Z': ['111', '001', '010', '100', '111']
};

function buildCrcTable() {
    const table = new Uint32Array(256);

    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }

    return table;
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i++) {
        crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(data.length, 0);

    const crcBuffer = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuffer, data]));
    crcBuffer.writeUInt32BE(crc, 0);

    return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, rgba) {
    const zlib = require('zlib');
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);

    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0;
        rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const idat = zlib.deflateSync(raw, { level: 9 });

    return Buffer.concat([
        PNG_SIGNATURE,
        createChunk('IHDR', ihdr),
        createChunk('IDAT', idat),
        createChunk('IEND', Buffer.alloc(0))
    ]);
}

function color(hex) {
    const normalized = hex.replace('#', '');
    return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
        a: 255
    };
}

class Canvas {
    constructor(width, height, background) {
        this.width = width;
        this.height = height;
        this.buffer = Buffer.alloc(width * height * 4);
        this.fillRect(0, 0, width, height, background);
    }

    setPixel(x, y, fill) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
        const idx = (y * this.width + x) * 4;
        this.buffer[idx] = fill.r;
        this.buffer[idx + 1] = fill.g;
        this.buffer[idx + 2] = fill.b;
        this.buffer[idx + 3] = fill.a;
    }

    fillRect(x, y, width, height, fill) {
        const startX = Math.max(0, Math.floor(x));
        const startY = Math.max(0, Math.floor(y));
        const endX = Math.min(this.width, Math.ceil(x + width));
        const endY = Math.min(this.height, Math.ceil(y + height));

        for (let yy = startY; yy < endY; yy++) {
            for (let xx = startX; xx < endX; xx++) {
                this.setPixel(xx, yy, fill);
            }
        }
    }

    drawLine(x1, y1, x2, y2, fill, thickness = 1) {
        let startX = Math.round(x1);
        let startY = Math.round(y1);
        const endX = Math.round(x2);
        const endY = Math.round(y2);
        const dx = Math.abs(endX - startX);
        const dy = Math.abs(endY - startY);
        const sx = startX < endX ? 1 : -1;
        const sy = startY < endY ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this.fillRect(startX - Math.floor(thickness / 2), startY - Math.floor(thickness / 2), thickness, thickness, fill);
            if (startX === endX && startY === endY) break;
            const e2 = err * 2;
            if (e2 > -dy) {
                err -= dy;
                startX += sx;
            }
            if (e2 < dx) {
                err += dx;
                startY += sy;
            }
        }
    }

    drawText(x, y, text, fill, scale = 2) {
        const upper = String(text).toUpperCase();
        let cursorX = Math.round(x);

        for (const char of upper) {
            const glyph = FONT[char] || FONT[' '];
            for (let row = 0; row < glyph.length; row++) {
                for (let col = 0; col < glyph[row].length; col++) {
                    if (glyph[row][col] === '1') {
                        this.fillRect(cursorX + col * scale, y + row * scale, scale, scale, fill);
                    }
                }
            }
            cursorX += (glyph[0].length + 1) * scale;
        }
    }

    toPng() {
        return encodePng(this.width, this.height, this.buffer);
    }
}

function getMinMax(candles) {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    candles.forEach(candle => {
        min = Math.min(min, candle.low);
        max = Math.max(max, candle.high);
    });

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        min = 0;
        max = 1;
    }

    if (min === max) {
        min -= 1;
        max += 1;
    }

    return { min, max };
}

function formatPrice(value) {
    return Number(value).toFixed(2);
}

function formatXAxisLabel(timestamp, intervalLabel) {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    if (['1m', '3m', '5m', '30m', '1h'].includes(intervalLabel)) {
        return `${day}/${month} ${hours}:${minutes}`;
    }

    return `${day}/${month}/${year}`;
}

function renderCandlestickChart({ candles, instrument, intervalLabel }) {
    if (!Array.isArray(candles) || candles.length === 0) {
        throw new Error('No candles available for chart rendering.');
    }

    const width = 1280;
    const height = 720;
    const padding = { top: 60, right: 110, bottom: 88, left: 78 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const palette = {
        bg: color('#f7f4ee'),
        panel: color('#fffdf8'),
        grid: color('#ddd5c9'),
        axis: color('#6f665a'),
        bull: color('#178f5d'),
        bear: color('#c6493c'),
        text: color('#2c241d'),
        volume: color('#c9d7e5'),
        priceLine: color('#9a8f80')
    };

    const canvas = new Canvas(width, height, palette.bg);
    canvas.fillRect(30, 25, width - 60, height - 50, palette.panel);

    const { min, max } = getMinMax(candles);
    const priceRange = max - min;
    const scaleY = value => {
        const normalized = (value - min) / priceRange;
        return padding.top + chartHeight - normalized * chartHeight;
    };

    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        canvas.drawLine(padding.left, y, width - padding.right, y, palette.grid, 1);
        const price = max - (priceRange / 5) * i;
        canvas.drawText(8, Math.round(y - 6), formatPrice(price), palette.text, 2);
    }

    canvas.drawLine(padding.left, padding.top, padding.left, padding.top + chartHeight, palette.axis, 2);
    canvas.drawLine(padding.left, padding.top + chartHeight, width - padding.right, padding.top + chartHeight, palette.axis, 2);

    const slotWidth = chartWidth / candles.length;
    const bodyWidth = Math.max(3, Math.min(10, Math.floor(slotWidth * 0.6)));
    const volumeMax = candles.reduce((current, candle) => Math.max(current, candle.volume || 0), 0) || 1;
    const volumeAreaHeight = Math.max(60, Math.floor(chartHeight * 0.18));
    const volumeBaseY = padding.top + chartHeight;

    candles.forEach((candle, index) => {
        const xCenter = padding.left + slotWidth * index + slotWidth / 2;
        const wickTop = scaleY(candle.high);
        const wickBottom = scaleY(candle.low);
        const openY = scaleY(candle.open);
        const closeY = scaleY(candle.close);
        const isBull = candle.close >= candle.open;
        const fill = isBull ? palette.bull : palette.bear;
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(2, Math.abs(closeY - openY));
        const bodyLeft = xCenter - bodyWidth / 2;

        const volumeHeight = Math.max(1, Math.round(((candle.volume || 0) / volumeMax) * volumeAreaHeight));
        canvas.fillRect(bodyLeft, volumeBaseY - volumeHeight, bodyWidth, volumeHeight, palette.volume);

        canvas.drawLine(xCenter, wickTop, xCenter, wickBottom, fill, 1);
        canvas.fillRect(bodyLeft, bodyTop, bodyWidth, bodyHeight, fill);
    });

    const lastClose = candles[candles.length - 1].close;
    const lastY = scaleY(lastClose);
    canvas.drawLine(padding.left, lastY, width - padding.right, lastY, palette.priceLine, 1);
    canvas.drawText(width - padding.right + 8, Math.round(lastY - 6), formatPrice(lastClose), palette.text, 2);

    const labelCount = Math.min(6, candles.length);
    for (let i = 0; i < labelCount; i++) {
        const candleIndex = Math.min(candles.length - 1, Math.round((i * (candles.length - 1)) / Math.max(1, labelCount - 1)));
        const candle = candles[candleIndex];
        const xCenter = padding.left + slotWidth * candleIndex + slotWidth / 2;
        const label = formatXAxisLabel(candle.timestamp, intervalLabel);
        canvas.drawLine(xCenter, padding.top + chartHeight, xCenter, padding.top + chartHeight + 6, palette.axis, 1);
        canvas.drawText(Math.round(xCenter - 24), padding.top + chartHeight + 12, label, palette.text, 2);
    }

    canvas.drawText(45, 32, instrument, palette.text, 3);
    canvas.drawText(width - 170, 32, intervalLabel, palette.text, 3);

    return {
        buffer: canvas.toPng(),
        caption: `${instrument} ${intervalLabel} chart (${candles.length} candles, last 100 max)`
    };
}

module.exports = {
    renderCandlestickChart
};
