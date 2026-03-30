import fs from "fs";
import path from "path";
import sharp from "sharp";

import type { PortfolioSnapshotRecord } from "../types/storage";

const FONT_FILE = path.resolve(
    process.cwd(),
    "node_modules",
    "@fontsource-variable",
    "inter",
    "files",
    "inter-latin-wght-normal.woff2",
);
let embeddedFontCss: string | undefined;

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

function formatRupeeShort(n: number): string {
    const v = Math.abs(n);
    if (v >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
    if (v >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
    if (v >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
    return `₹${Math.round(n)}`;
}

function formatRupeeInr(n: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(Math.round(n));
}

function formatDateLabel(ms: number): string {
    const d = new Date(ms);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
}

/** Telegram sendPhoto: width + height must not exceed 10000 in total (Bot API). */
const TELEGRAM_PHOTO_MAX_SIDE_SUM = 9990;

function dimensionsForTelegramPhoto(logicalW: number, logicalH: number) {
    const aspect = logicalW / logicalH;
    const h = Math.floor(TELEGRAM_PHOTO_MAX_SIDE_SUM / (aspect + 1));
    const w = Math.floor(TELEGRAM_PHOTO_MAX_SIDE_SUM - h);
    return { width: w, height: h };
}

/** Dashboard-style palette (readable on white). */
const palette = {
    bg: "#ffffff",
    text: "#0f172a",
    textMuted: "#64748b",
    textSoft: "#94a3b8",
    grid: "#e2e8f0",
    axis: "#475569",
    pointRing: "#ffffff",
    pointOutline: "#1e293b",
};

const SERIES = [
    { key: "mfInvested" as const, label: "MF invested", color: "#2563eb" },
    { key: "mfCurrent" as const, label: "MF current", color: "#7c3aed" },
    { key: "eqInvested" as const, label: "Equity invested", color: "#16a34a" },
    { key: "eqCurrent" as const, label: "Equity current", color: "#ea580c" },
];

export async function renderPortfolioSnapshotLineChart(snapshots: PortfolioSnapshotRecord[]) {
    if (!snapshots.length) {
        throw new Error("No snapshots to chart.");
    }

    const latest = snapshots[snapshots.length - 1];
    const totalInvested = latest.mfInvested + latest.eqInvested;
    const totalCurrent = latest.mfCurrent + latest.eqCurrent;
    const pnl = totalCurrent - totalInvested;
    const pnlPct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
    const pnlColor = pnl > 0 ? "#15803d" : pnl < 0 ? "#dc2626" : palette.textMuted;
    const pnlSign = pnl > 0 ? "+" : "";
    const pnlLine = `${pnlSign}${formatRupeeInr(pnl)} (${pnlSign}${pnlPct.toFixed(2)}%)`;

    const width = 1920;
    const footerHeight = 188;
    const xLabelBand = 52;
    const height = 1240;

    const marginX = 120;
    const headerEyebrowY = 40;
    const headerTitleY = 92;
    const headerSubtitleY = 138;
    const kpiLabelY = 178;
    const kpiValueY = 238;
    const legendY = 288;
    const chartTop = 348;
    const padding = {
        top: chartTop,
        right: 100,
        bottom: xLabelBand + footerHeight,
        left: marginX,
    };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const footerTop = height - footerHeight;
    const xLabelY = footerTop - 26;

    const colW = (width - marginX * 2) / 3;
    const colX = (i: number) => marginX + colW * i;

    let minV = Number.POSITIVE_INFINITY;
    let maxV = Number.NEGATIVE_INFINITY;
    for (const s of snapshots) {
        minV = Math.min(minV, s.mfInvested, s.mfCurrent, s.eqInvested, s.eqCurrent);
        maxV = Math.max(maxV, s.mfInvested, s.mfCurrent, s.eqInvested, s.eqCurrent);
    }
    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) {
        minV = 0;
        maxV = 1;
    }
    if (minV === maxV) {
        minV -= 1;
        maxV += 1;
    }
    const padY = (maxV - minV) * 0.08;
    minV -= padY;
    maxV += padY;

    const n = snapshots.length;
    const xAt = (i: number) => padding.left + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
    const yAt = (v: number) => padding.top + chartH - ((v - minV) / (maxV - minV)) * chartH;

    const yTicks = 5;
    const gridLines: string[] = [];
    const yLabels: string[] = [];
    for (let t = 0; t <= yTicks; t++) {
        const frac = t / yTicks;
        const val = minV + (maxV - minV) * (1 - frac);
        const y = padding.top + (chartH / yTicks) * t;
        gridLines.push(
            `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="${palette.grid}" stroke-width="1" />`,
        );
        yLabels.push(
            `<text x="${padding.left - 14}" y="${y + 5}" class="axis-label" text-anchor="end">${escapeXml(formatRupeeShort(val))}</text>`,
        );
    }

    const xLabels: string[] = [];
    const labelStep = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i += labelStep) {
        const x = xAt(i);
        xLabels.push(
            `<text x="${x}" y="${xLabelY}" class="axis-label center">${escapeXml(formatDateLabel(snapshots[i].createdAt))}</text>`,
        );
    }
    if ((n - 1) % labelStep !== 0 && n > 1) {
        const i = n - 1;
        const x = xAt(i);
        xLabels.push(
            `<text x="${x}" y="${xLabelY}" class="axis-label center">${escapeXml(formatDateLabel(snapshots[i].createdAt))}</text>`,
        );
    }

    const polylines: string[] = [];
    const pointMarkers: string[] = [];
    const pointR = 8;
    const ringW = 2.5;

    if (n > 1) {
        for (const { key, color } of SERIES) {
            const pts = snapshots.map((s, i) => `${xAt(i).toFixed(1)},${yAt(s[key]).toFixed(1)}`).join(" ");
            polylines.push(
                `<polyline fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${pts}" />`,
            );
            for (let i = 0; i < n; i++) {
                const cx = xAt(i);
                const cy = yAt(snapshots[i][key]);
                pointMarkers.push(
                    `<circle cx="${cx}" cy="${cy}" r="${pointR + ringW}" fill="${palette.pointOutline}" />` +
                        `<circle cx="${cx}" cy="${cy}" r="${pointR}" fill="${color}" stroke="${palette.pointRing}" stroke-width="${ringW}" />`,
                );
            }
        }
    } else {
        for (const { key, color } of SERIES) {
            const s = snapshots[0];
            const cx = xAt(0);
            const cy = yAt(s[key]);
            pointMarkers.push(
                `<circle cx="${cx}" cy="${cy}" r="${pointR + ringW}" fill="${palette.pointOutline}" />` +
                    `<circle cx="${cx}" cy="${cy}" r="${pointR}" fill="${color}" stroke="${palette.pointRing}" stroke-width="${ringW}" />`,
            );
        }
    }

    const legendGap = 44;
    const legendStartX = marginX;
    const legendItemW = (width - marginX * 2 - legendGap * (SERIES.length - 1)) / SERIES.length;
    const legendItems = SERIES.map((ser, idx) => {
        const lx = legendStartX + idx * (legendItemW + legendGap);
        return (
            `<line x1="${lx}" y1="${legendY}" x2="${lx + 28}" y2="${legendY}" stroke="${ser.color}" stroke-width="4" stroke-linecap="round" />` +
            `<circle cx="${lx + 22}" cy="${legendY}" r="5" fill="${ser.color}" stroke="${palette.pointOutline}" stroke-width="1" />` +
            `<text x="${lx + 40}" y="${legendY + 6}" class="legend-text">${escapeXml(ser.label)}</text>`
        );
    }).join("");

    const headerBlock =
        `<text x="${marginX}" y="${headerEyebrowY}" class="eyebrow">WEEKLY SNAPSHOTS</text>` +
        `<text x="${marginX}" y="${headerTitleY}" class="title">Portfolio snapshots</text>` +
        `<text x="${marginX}" y="${headerSubtitleY}" class="subtitle">Mutual fund &amp; equity — invested vs current value</text>` +
        `<text x="${colX(0)}" y="${kpiLabelY}" class="kpi-label">TOTAL INVESTED</text>` +
        `<text x="${colX(0)}" y="${kpiValueY}" class="kpi-value">${escapeXml(formatRupeeInr(totalInvested))}</text>` +
        `<text x="${colX(1)}" y="${kpiLabelY}" class="kpi-label">TOTAL CURRENT</text>` +
        `<text x="${colX(1)}" y="${kpiValueY}" class="kpi-value">${escapeXml(formatRupeeInr(totalCurrent))}</text>` +
        `<text x="${colX(2)}" y="${kpiLabelY}" class="kpi-label">P&amp;L (LATEST)</text>` +
        `<text x="${colX(2)}" y="${kpiValueY}" class="kpi-value-pnl" fill="${pnlColor}">${escapeXml(pnlLine)}</text>`;

    const footerSummary =
        `<rect x="0" y="${footerTop}" width="${width}" height="${footerHeight}" fill="#f8fafc" stroke="${palette.grid}" stroke-width="1" />` +
        `<line x1="0" y1="${footerTop}" x2="${width}" y2="${footerTop}" stroke="${palette.grid}" stroke-width="2" />` +
        `<text x="${colX(0)}" y="${footerTop + 48}" class="footer-kpi-label">TOTAL INVESTED</text>` +
        `<text x="${colX(0)}" y="${footerTop + 98}" class="footer-kpi-value">${escapeXml(formatRupeeInr(totalInvested))}</text>` +
        `<text x="${colX(1)}" y="${footerTop + 48}" class="footer-kpi-label">TOTAL CURRENT</text>` +
        `<text x="${colX(1)}" y="${footerTop + 98}" class="footer-kpi-value">${escapeXml(formatRupeeInr(totalCurrent))}</text>` +
        `<text x="${colX(2)}" y="${footerTop + 48}" class="footer-kpi-label">P&amp;L</text>` +
        `<text x="${colX(2)}" y="${footerTop + 98}" class="footer-kpi-pnl" fill="${pnlColor}">${escapeXml(pnlLine)}</text>`;

    const svg =
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" text-rendering="geometricPrecision">` +
        `<defs><style type="text/css">${ensureFontCss()}` +
        `.eyebrow { font-family: Inter, sans-serif; font-size: 15px; font-weight: 600; fill: ${palette.textSoft}; letter-spacing: 0.2em; }` +
        `.title { font-family: Inter, sans-serif; font-size: 44px; font-weight: 700; fill: ${palette.text}; }` +
        `.subtitle { font-family: Inter, sans-serif; font-size: 21px; fill: ${palette.textMuted}; font-weight: 500; }` +
        `.kpi-label { font-family: Inter, sans-serif; font-size: 14px; font-weight: 600; fill: ${palette.textSoft}; letter-spacing: 0.12em; }` +
        `.kpi-value { font-family: Inter, sans-serif; font-size: 34px; font-weight: 700; fill: ${palette.text}; }` +
        `.kpi-value-pnl { font-family: Inter, sans-serif; font-size: 32px; font-weight: 700; }` +
        `.axis-label { font-family: Inter, sans-serif; font-size: 18px; fill: ${palette.textMuted}; font-weight: 500; }` +
        `.axis-label.center { text-anchor: middle; }` +
        `.legend-text { font-family: Inter, sans-serif; font-size: 19px; fill: ${palette.text}; font-weight: 600; }` +
        `.footer-kpi-label { font-family: Inter, sans-serif; font-size: 13px; font-weight: 600; fill: ${palette.textSoft}; letter-spacing: 0.1em; }` +
        `.footer-kpi-value { font-family: Inter, sans-serif; font-size: 26px; font-weight: 700; fill: ${palette.text}; }` +
        `.footer-kpi-pnl { font-family: Inter, sans-serif; font-size: 26px; font-weight: 700; }` +
        `</style></defs>` +
        `<rect width="100%" height="100%" fill="${palette.bg}" />` +
        headerBlock +
        legendItems +
        gridLines.join("") +
        `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartH}" stroke="${palette.axis}" stroke-width="2" />` +
        `<line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}" stroke="${palette.axis}" stroke-width="2" />` +
        yLabels.join("") +
        polylines.join("") +
        pointMarkers.join("") +
        xLabels.join("") +
        footerSummary +
        `</svg>`;

    const telegramSize = dimensionsForTelegramPhoto(width, height);
    const buffer = await sharp(Buffer.from(svg), { density: 300 })
        .resize(telegramSize.width, telegramSize.height, { fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();

    return {
        buffer,
        caption: `Snapshots: ${n} point(s). Lines: MF invested/current, Equity invested/current.`,
    };
}
