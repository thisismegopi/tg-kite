import { config } from '../config';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const FONT_FILE = path.resolve(process.cwd(), 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-wght-normal.woff2');
const MAX_OUTPUT_WIDTH = 2000;
const MAX_OUTPUT_HEIGHT = 4000;
let embeddedFontCss: string | undefined;

export interface TableColumn {
    key: string;
    label: string;
    offset: number;
    align?: 'right';
    emphasis?: boolean;
    trim?: number;
    metric?: boolean;
}

export interface TableCell {
    key: string;
    text: string | number;
    tone?: 'gain' | 'loss' | 'flat';
    bold?: boolean;
}

export interface TableRow {
    cells: TableCell[];
}

interface RenderTableOptions {
    title: string;
    subtitle: string;
    columns: TableColumn[];
    rows: TableRow[];
    footerLines?: string[];
}

function ensureFontCss() {
    if (!embeddedFontCss) {
        const fontData = fs.readFileSync(FONT_FILE).toString('base64');
        embeddedFontCss = '@font-face {' + "font-family: 'Inter';" + `src: url(data:font/woff2;base64,${fontData}) format("woff2");` + 'font-weight: 100 900;' + 'font-style: normal;' + '}';
    }

    return embeddedFontCss;
}

function escapeXml(value: string | number) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function trimText(value: string, maxLength = 28) {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 3)}...`;
}

async function renderTableImage(options: RenderTableOptions) {
    const { title, subtitle, columns, rows, footerLines = [] } = options;

    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('No rows available for image rendering.');
    }

    const width = 1600;
    const headerHeight = 116;
    const headerRowHeight = 58;
    const rowHeight = 48;
    const footerHeight = Math.max(54, 28 + footerLines.length * 22);
    const height = headerHeight + headerRowHeight + rows.length * rowHeight + footerHeight + 56;

    const palette = {
        bg: '#edf3ef',
        panel: '#fffefb',
        headerBand: '#dde9e3',
        panelBorder: '#cad8d0',
        tableHeader: '#203129',
        text: '#223127',
        muted: '#6d7c73',
        rowEven: '#fbfcfb',
        rowOdd: '#f1f6f3',
        divider: '#d7e1db',
        gain: '#138a54',
        loss: '#cc4d42',
        flat: '#8a948f',
    };

    const tableX = 56;
    const tableY = 136;
    const tableWidth = width - 112;
    const watermarkText = (config.telegramBotUsername || '').trim().replace(/^@+/, '');
    const resolvedColumns = columns.map(column => ({
        ...column,
        x: tableX + column.offset,
    }));

    const rowsSvg = rows
        .map((row, index) => {
            const rowY = tableY + headerRowHeight + index * rowHeight;
            const bg = index % 2 === 0 ? palette.rowEven : palette.rowOdd;
            const baselineY = rowY + 31;

            const cellsSvg = row.cells
                .map(cell => {
                    const column = resolvedColumns.find(item => item.key === cell.key);
                    if (!column) {
                        return '';
                    }

                    const classNames = ['cell', column.metric ? 'metric' : '', column.emphasis ? 'symbol' : '', column.align === 'right' ? 'right' : '', cell.bold ? 'strong' : '', cell.tone || '']
                        .filter(Boolean)
                        .join(' ');

                    const text = column.trim ? trimText(String(cell.text), column.trim) : String(cell.text);
                    return `<text x="${column.x}" y="${baselineY}" class="${classNames}">${escapeXml(text)}</text>`;
                })
                .join('');

            return `
            <rect x="${tableX}" y="${rowY}" width="${tableWidth}" height="${rowHeight}" fill="${bg}" />
            <line x1="${tableX}" y1="${rowY + rowHeight - 1}" x2="${tableX + tableWidth}" y2="${rowY + rowHeight - 1}" stroke="${palette.divider}" stroke-width="1" />
            ${cellsSvg}
        `;
        })
        .join('');

    const headerSvg = resolvedColumns
        .map(column => {
            const className = column.align === 'right' ? 'head right' : 'head';
            return `<text x="${column.x}" y="171" class="${className}">${escapeXml(column.label)}</text>`;
        })
        .join('');

    const footerSvg = footerLines
        .map((line, index) => {
            const y = tableY + headerRowHeight + rows.length * rowHeight + 34 + index * 22;
            return `<text x="58" y="${y}" class="subtitle">${escapeXml(line)}</text>`;
        })
        .join('');

    const watermarkSvg = watermarkText
        ? `<g transform="translate(${width / 2} ${height / 2}) rotate(-24)">
                <text x="0" y="0" class="watermark">${escapeXml(`@${watermarkText}`)}</text>
           </g>`
        : '';

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <defs>
                <style>
                    ${ensureFontCss()}
                    text { font-family: 'Inter'; }
                    .title { font-size: 31px; font-weight: 800; fill: ${palette.text}; }
                    .title-shadow { font-size: 31px; font-weight: 800; fill: ${palette.text}; opacity: 0.96; }
                    .subtitle { font-size: 13px; font-weight: 500; fill: ${palette.muted}; }
                    .head { font-size: 14px; font-weight: 800; fill: #fffefb; }
                    .cell { font-size: 14px; font-weight: 500; fill: ${palette.text}; }
                    .metric { font-size: 15px; font-weight: 700; }
                    .symbol { font-weight: 800; }
                    .strong { font-weight: 700; }
                    .right { text-anchor: end; }
                    .gain { fill: ${palette.gain}; }
                    .loss { fill: ${palette.loss}; }
                    .flat { fill: ${palette.flat}; }
                    .watermark {
                        font-size: 122px;
                        font-weight: 800;
                        letter-spacing: 4px;
                        fill: ${palette.text};
                        opacity: 0.10;
                        text-anchor: middle;
                        dominant-baseline: middle;
                    }
                </style>
            </defs>
            <rect width="100%" height="100%" fill="${palette.bg}" />
            <rect x="24" y="20" width="${width - 48}" height="${height - 40}" fill="${palette.panel}" />
            <rect x="24" y="20" width="${width - 48}" height="88" fill="${palette.headerBand}" />
            <rect x="24" y="108" width="${width - 48}" height="2" fill="${palette.panelBorder}" />
            <text x="58.6" y="60" class="title-shadow">${escapeXml(title)}</text>
            <text x="58" y="60" class="title">${escapeXml(title)}</text>
            <text x="58" y="90" class="subtitle">${escapeXml(subtitle)}</text>
            <rect x="${tableX}" y="${tableY}" width="${tableWidth}" height="${headerRowHeight}" fill="${palette.tableHeader}" />
            ${headerSvg}
            ${rowsSvg}
            ${footerSvg}
            ${watermarkSvg}
        </svg>
    `;

    return sharp(Buffer.from(svg), { density: 192 })
        .resize({
            width: MAX_OUTPUT_WIDTH,
            height: MAX_OUTPUT_HEIGHT,
            fit: 'inside',
            withoutEnlargement: true,
        })
        .png({ compressionLevel: 9, quality: 100 })
        .toBuffer();
}

export { renderTableImage };
