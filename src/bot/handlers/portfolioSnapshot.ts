import { BotContext } from '../../types/bot';
import { getActorFromContext } from '../../core/actor';
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
        const actor = getActorFromContext(ctx);
        if (!ctx.kite || !actor) {
            throw Error('Kite instance not found');
        }
        await ctx.reply('Fetching portfolio and building chart…');

        const aggregated = await portfolioAnalyzer.aggregatePortfolio(ctx.kite);
        if (aggregated.portfolio_summary.holdings_count === 0) {
            return ctx.reply('No equity or mutual fund holdings found. Nothing to snapshot.');
        }

        const last = db.getLastPortfolioSnapshot(actor.actorId);
        const now = Date.now();
        const canCreate = !last || now - last.createdAt >= SEVEN_DAYS_MS;

        let captionExtra: string;
        if (canCreate) {
            const totals = snapshotTotalsFromAggregated(aggregated);
            db.insertPortfolioSnapshot(actor.actorId, actor.platform, actor.platformUserId, totals);
            captionExtra = 'New snapshot saved.';
        } else {
            const nextAt = new Date(last!.createdAt + SEVEN_DAYS_MS);
            captionExtra = `Next new snapshot after ${nextAt.toLocaleString()} (one per 7 days). Showing history.`;
        }

        const rows = db.listPortfolioSnapshotsForChart(actor.actorId);
        const { buffer, caption } = await renderPortfolioSnapshotLineChart(rows);

        return await ctx.replyWithPhoto({ source: buffer }, { caption: `${captionExtra}\n${caption}` });
    } catch (err: any) {
        return await ctx.reply(`Error: ${err.message ?? err}`);
    }
};

export = {
    portfolioSnapshot,
};
