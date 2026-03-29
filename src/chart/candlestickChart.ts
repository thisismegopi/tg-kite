import fs from "fs";
import path from "path";
import sharp from "sharp";

const FONT_FILE = path.resolve(process.cwd(), "node_modules", "@fontsource-variable", "inter", "files", "inter-latin-wght-normal.woff2");
let embeddedFontCss: string | undefined;

interface Candle {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface RenderCandlestickChartOptions {
    candles: Candle[];
    instrument: string;
    intervalLabel: string;
}

function ensureFontCss() {
    if (!embeddedFontCss) {
        const fontData = fs.readFileSync(FONT_FILE).toString("base64");
        embeddedFontCss =
            "@font-face {" +
            "font-family: 'Inter';" +
            `src: url(data:font/woff2;base64,${fontData}) format("woff2");` +
            "font-weight: 100 900;" +
            "font-style: normal;" +
            "}";
    }

    return embeddedFontCss;
}

function escapeXml(value: string) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function getMinMax(candles: Candle[]) {
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

function formatPrice(value: number) {
    return Number(value).toFixed(2);
}

function formatXAxisLabel(timestamp: Date, intervalLabel: string) {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    if (["1m", "3m", "5m", "30m", "1h"].includes(intervalLabel)) {
        return `${day}/${month} ${hours}:${minutes}`;
    }

    return `${day}/${month}/${year}`;
}

async function renderCandlestickChart({ candles, instrument, intervalLabel }: RenderCandlestickChartOptions) {
    if (!Array.isArray(candles) || candles.length === 0) {
        throw new Error("No candles available for chart rendering.");
    }

    const width = 1280;
    const height = 720;
    const padding = { top: 82, right: 128, bottom: 108, left: 96 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const palette = {
        bg: "#ffffff",
        panel: "#ffffff",
        grid: "#e7e7e7",
        axis: "#8a8a8a",
        bull: "#178f5d",
        bear: "#c6493c",
        text: "#1f1f1f",
        volume: "#d9e3f0",
        priceLine: "#8d8d8d",
    };

    const { min, max } = getMinMax(candles);
    const priceRange = max - min;
    const scaleY = (value: number) => {
        const normalized = (value - min) / priceRange;
        return padding.top + chartHeight - normalized * chartHeight;
    };

    const gridLines: string[] = [];
    const priceLabels: string[] = [];
    for (let i = 0; i <= 5; i += 1) {
        const y = padding.top + (chartHeight / 5) * i;
        const price = max - (priceRange / 5) * i;
        gridLines.push(`<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="${palette.grid}" stroke-width="1" />`);
        priceLabels.push(`<text x="82" y="${y + 6}" class="axis-label right">${formatPrice(price)}</text>`);
    }

    const slotWidth = chartWidth / candles.length;
    const bodyWidth = Math.max(3, Math.min(10, Math.floor(slotWidth * 0.6)));
    const volumeMax = candles.reduce((current, candle) => Math.max(current, candle.volume || 0), 0) || 1;
    const volumeAreaHeight = Math.max(60, Math.floor(chartHeight * 0.18));
    const volumeBaseY = padding.top + chartHeight;

    const candleSvg = candles.map((candle, index) => {
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

        return `
            <rect x="${bodyLeft}" y="${volumeBaseY - volumeHeight}" width="${bodyWidth}" height="${volumeHeight}" fill="${palette.volume}" />
            <line x1="${xCenter}" y1="${wickTop}" x2="${xCenter}" y2="${wickBottom}" stroke="${fill}" stroke-width="1" />
            <rect x="${bodyLeft}" y="${bodyTop}" width="${bodyWidth}" height="${bodyHeight}" fill="${fill}" />
        `;
    }).join("");

    const lastClose = candles[candles.length - 1].close;
    const lastY = scaleY(lastClose);

    const labelCount = Math.min(6, candles.length);
    const xAxisLabels: string[] = [];
    for (let i = 0; i < labelCount; i += 1) {
        const candleIndex = Math.min(candles.length - 1, Math.round((i * (candles.length - 1)) / Math.max(1, labelCount - 1)));
        const candle = candles[candleIndex];
        const xCenter = padding.left + slotWidth * candleIndex + slotWidth / 2;
        const label = formatXAxisLabel(candle.timestamp, intervalLabel);
        xAxisLabels.push(`<line x1="${xCenter}" y1="${padding.top + chartHeight}" x2="${xCenter}" y2="${padding.top + chartHeight + 6}" stroke="${palette.axis}" stroke-width="1" />`);
        xAxisLabels.push(`<text x="${xCenter}" y="${padding.top + chartHeight + 28}" class="axis-label center">${escapeXml(label)}</text>`);
    }

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <defs>
                <style>
                    ${ensureFontCss()}
                    text { font-family: 'Inter'; fill: ${palette.text}; }
                    .title { font-size: 28px; font-weight: 800; }
                    .subtitle { font-size: 26px; font-weight: 700; }
                    .axis-label { font-size: 15px; font-weight: 500; fill: ${palette.text}; }
                    .right { text-anchor: end; }
                    .center { text-anchor: middle; }
                </style>
            </defs>
            <rect width="100%" height="100%" fill="${palette.bg}" />
            <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="${palette.panel}" />
            ${gridLines.join("")}
            <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartHeight}" stroke="${palette.axis}" stroke-width="2" />
            <line x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${width - padding.right}" y2="${padding.top + chartHeight}" stroke="${palette.axis}" stroke-width="2" />
            ${priceLabels.join("")}
            ${candleSvg}
            <line x1="${padding.left}" y1="${lastY}" x2="${width - padding.right}" y2="${lastY}" stroke="${palette.priceLine}" stroke-width="1" />
            <text x="${width - padding.right + 8}" y="${lastY + 6}" class="axis-label">${formatPrice(lastClose)}</text>
            ${xAxisLabels.join("")}
            <text x="52" y="54" class="title">${escapeXml(instrument)}</text>
            <text x="${width - 130}" y="54" class="subtitle right">${escapeXml(intervalLabel)}</text>
        </svg>
    `;

    const buffer = await sharp(Buffer.from(svg), { density: 192 })
        .png({ compressionLevel: 9, quality: 100 })
        .toBuffer();

    return {
        buffer,
        caption: `${instrument} ${intervalLabel} chart (${candles.length} candles, last 100 max)`,
    };
}

export { renderCandlestickChart };
