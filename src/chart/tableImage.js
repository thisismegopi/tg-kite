const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FONT_FILE = path.resolve(process.cwd(), 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-wght-normal.woff2');
const MAX_OUTPUT_WIDTH = 2000;
const MAX_OUTPUT_HEIGHT = 4000;
let embeddedFontCss;

function ensureFontCss() {
    if (!embeddedFontCss) {
        const fontData = fs.readFileSync(FONT_FILE).toString('base64');
        embeddedFontCss = '@font-face {' + "font-family: 'Inter';" + 'src: url(data:font/woff2;base64,' + fontData + ') format("woff2");' + 'font-weight: 100 900;' + 'font-style: normal;' + '}';
    }

    return embeddedFontCss;
}

function escapeXml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function trimText(value, maxLength = 28) {
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength - 3) + '...';
}

async function renderTableImage(options) {
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
                    const classNames = ['cell', column.metric ? 'metric' : '', column.emphasis ? 'symbol' : '', column.align === 'right' ? 'right' : '', cell.bold ? 'strong' : '', cell.tone || '']
                        .filter(Boolean)
                        .join(' ');
                    const text = column.trim ? trimText(String(cell.text), column.trim) : String(cell.text);

                    return '<text x="' + column.x + '" y="' + baselineY + '" class="' + classNames + '">' + escapeXml(text) + '</text>';
                })
                .join('');

            return (
                '\n            <rect x="' +
                tableX +
                '" y="' +
                rowY +
                '" width="' +
                tableWidth +
                '" height="' +
                rowHeight +
                '" fill="' +
                bg +
                '" />\n' +
                '            <line x1="' +
                tableX +
                '" y1="' +
                (rowY + rowHeight - 1) +
                '" x2="' +
                (tableX + tableWidth) +
                '" y2="' +
                (rowY + rowHeight - 1) +
                '" stroke="' +
                palette.divider +
                '" stroke-width="1" />\n' +
                '            ' +
                cellsSvg +
                '\n        '
            );
        })
        .join('');

    const headerSvg = resolvedColumns
        .map(column => {
            const className = column.align === 'right' ? 'head right' : 'head';
            return '<text x="' + column.x + '" y="171" class="' + className + '">' + escapeXml(column.label) + '</text>';
        })
        .join('');

    const footerSvg = footerLines
        .map((line, index) => {
            const y = tableY + headerRowHeight + rows.length * rowHeight + 34 + index * 22;
            return '<text x="58" y="' + y + '" class="subtitle">' + escapeXml(line) + '</text>';
        })
        .join('');

    const svg =
        '\n        <svg xmlns="http://www.w3.org/2000/svg" width="' +
        width +
        '" height="' +
        height +
        '" viewBox="0 0 ' +
        width +
        ' ' +
        height +
        '">\n' +
        '            <defs>\n' +
        '                <style>\n' +
        '                    ' +
        ensureFontCss() +
        '\n' +
        "                    text { font-family: 'Inter'; }\n" +
        '                    .title { font-size: 31px; font-weight: 800; fill: ' +
        palette.text +
        '; }\n' +
        '                    .title-shadow { font-size: 31px; font-weight: 800; fill: ' +
        palette.text +
        '; opacity: 0.96; }\n' +
        '                    .subtitle { font-size: 13px; font-weight: 500; fill: ' +
        palette.muted +
        '; }\n' +
        '                    .head { font-size: 14px; font-weight: 700; fill: #fffefb; font-weight: 800; }\n' +
        '                    .cell { font-size: 14px; font-weight: 500; fill: ' +
        palette.text +
        '; }\n' +
        '                    .metric { font-size: 15px; font-weight: 700; }\n' +
        '                    .symbol { font-weight: 800; }\n' +
        '                    .strong { font-weight: 700; }\n' +
        '                    .right { text-anchor: end; }\n' +
        '                    .gain { fill: ' +
        palette.gain +
        '; }\n' +
        '                    .loss { fill: ' +
        palette.loss +
        '; }\n' +
        '                    .flat { fill: ' +
        palette.flat +
        '; }\n' +
        '                </style>\n' +
        '            </defs>\n' +
        '            <rect width="100%" height="100%" fill="' +
        palette.bg +
        '" />\n' +
        '            <rect x="24" y="20" width="' +
        (width - 48) +
        '" height="' +
        (height - 40) +
        '" fill="' +
        palette.panel +
        '" />\n' +
        '            <rect x="24" y="20" width="' +
        (width - 48) +
        '" height="88" fill="' +
        palette.headerBand +
        '" />\n' +
        '            <rect x="24" y="108" width="' +
        (width - 48) +
        '" height="2" fill="' +
        palette.panelBorder +
        '" />\n' +
        '            <text x="58.6" y="60" class="title-shadow">' +
        escapeXml(title) +
        '</text>\n' +
        '            <text x="58" y="60" class="title">' +
        escapeXml(title) +
        '</text>\n' +
        '            <text x="58" y="90" class="subtitle">' +
        escapeXml(subtitle) +
        '</text>\n' +
        '            <rect x="' +
        tableX +
        '" y="' +
        tableY +
        '" width="' +
        tableWidth +
        '" height="' +
        headerRowHeight +
        '" fill="' +
        palette.tableHeader +
        '" />\n' +
        '            ' +
        headerSvg +
        '\n' +
        '            ' +
        rowsSvg +
        '\n' +
        '            ' +
        footerSvg +
        '\n' +
        '        </svg>\n';

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

module.exports = {
    renderTableImage,
};
