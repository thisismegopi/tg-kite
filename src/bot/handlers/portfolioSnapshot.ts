import { BotContext } from '../../types/bot';
import db from '../../storage/db';
import portfolioAnalyzer from '../../ai/portfolioAnalyzer';
import { renderPortfolioSnapshotLineChart } from '../../chart/portfolioSnapshotChart';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function snapshotTotalsFromAggregated(aggregated: Awaited<ReturnType<typeof portfolioAnalyzer.aggregatePortfolio>>) {
    const eqInvested = aggregated.holdings.reduce((sum, h) => sum + h.avg_price * h.quantity, 0);
    const mfInvested = aggregated.mutual_funds.reduce((sum, m) => sum + m.invested_value, 0);
    return {
        mfInvested: Math.round(mfInvested),
        mfCurrent: Math.round(aggregated.portfolio_summary.mf_value),
        eqInvested: Math.round(eqInvested),
        eqCurrent: Math.round(aggregated.portfolio_summary.equity_value),
    };
}

const portfolioSnapshot = async (ctx: BotContext) => {
    try {
        if (!ctx.kite || !ctx.from) {
            throw Error('Kite instance not found');
        }
        await ctx.reply('Fetching portfolio and building chart…');

        const aggregated = await portfolioAnalyzer.aggregatePortfolio(ctx.kite);
        if (aggregated.portfolio_summary.holdings_count === 0) {
            return ctx.reply('No equity or mutual fund holdings found. Nothing to snapshot.');
        }

        const userId = ctx.from.id;
        const last = db.getLastPortfolioSnapshot(userId);
        const now = Date.now();
        const canCreate = !last || now - last.createdAt >= SEVEN_DAYS_MS;

        let captionExtra: string;
        if (canCreate) {
            const totals = snapshotTotalsFromAggregated(aggregated);
            db.insertPortfolioSnapshot(userId, totals);
            captionExtra = 'New snapshot saved.';
        } else {
            const nextAt = new Date(last!.createdAt + SEVEN_DAYS_MS);
            captionExtra = `Next new snapshot after ${nextAt.toLocaleString()} (one per 7 days). Showing history.`;
        }

        const rows = db.listPortfolioSnapshotsForChart(userId);
        const { buffer, caption } = await renderPortfolioSnapshotLineChart(rows);

        return await ctx.replyWithPhoto({ source: buffer, filename: `snapshot-${new Date().toISOString()}` }, { caption: `${captionExtra}\n${caption}` });
    } catch (err: any) {
        return await ctx.reply(`Error: ${err.message ?? err}`);
    }
};

export = {
    portfolioSnapshot,
};
