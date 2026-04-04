import type { BotContext } from './types/bot';
import { Message } from 'telegraf/types';
import analyzeHandlers from './bot/handlers/analyze';
import authHandlers from './bot/handlers/auth';
import authMiddleware from './bot/middleware/auth';
import chartHandlers from './bot/handlers/chart';
import marketQuoteHandlers from './bot/handlers/marketQuotes';
import mfHandlers from './bot/handlers/mutualFunds';
import orderHandlers from './bot/handlers/orders';
import portfolioHandlers from './bot/handlers/portfolio';
import portfolioSnapshotHandlers from './bot/handlers/portfolioSnapshot';
import watchlistHandlers from './bot/handlers/watchlist';

type RouteHandler = (ctx: BotContext) => Promise<Message.TextMessage | Message.PhotoMessage | Message.DocumentMessage | undefined>;

const commandHandlers: Record<string, { handler: RouteHandler; requireAuth?: boolean }> = {
    start: { handler: authHandlers.start },
    help: { handler: authHandlers.help },
    login: { handler: authHandlers.login },
    logout: { handler: authHandlers.logout },
    me: { handler: authHandlers.me, requireAuth: true },
    holdings: { handler: portfolioHandlers.holdings, requireAuth: true },
    portfolio: { handler: portfolioHandlers.holdings, requireAuth: true },
    pfsnapshot: { handler: portfolioSnapshotHandlers.portfolioSnapshot, requireAuth: true },
    portfoliosnapshot: { handler: portfolioSnapshotHandlers.portfolioSnapshot, requireAuth: true },
    positions: { handler: portfolioHandlers.positions, requireAuth: true },
    balance: { handler: portfolioHandlers.balance, requireAuth: true },
    funds: { handler: portfolioHandlers.balance, requireAuth: true },
    account: { handler: portfolioHandlers.balance, requireAuth: true },
    buy: { handler: orderHandlers.placeOrder, requireAuth: true },
    sell: { handler: orderHandlers.placeOrder, requireAuth: true },
    orders: { handler: orderHandlers.listOrders, requireAuth: true },
    orderstatus: { handler: orderHandlers.orderStatus, requireAuth: true },
    quote: { handler: marketQuoteHandlers.quote, requireAuth: true },
    ohlc: { handler: marketQuoteHandlers.ohlc, requireAuth: true },
    ltp: { handler: marketQuoteHandlers.ltp, requireAuth: true },
    chart: { handler: chartHandlers.chart, requireAuth: true },
    watchadd: { handler: watchlistHandlers.add, requireAuth: true },
    watchremove: { handler: watchlistHandlers.remove, requireAuth: true },
    watchlist: { handler: watchlistHandlers.list, requireAuth: true },
    instruments: { handler: watchlistHandlers.getInstrument, requireAuth: true },
    mfholdings: { handler: mfHandlers.mfHoldings, requireAuth: true },
    mutualfunds: { handler: mfHandlers.mfHoldings, requireAuth: true },
    mforders: { handler: mfHandlers.mfOrders, requireAuth: true },
    mforder: { handler: mfHandlers.mfOrder, requireAuth: true },
    mfsips: { handler: mfHandlers.mfSips, requireAuth: true },
    mfinstruments: { handler: mfHandlers.mfInstruments, requireAuth: true },
    analyze: { handler: analyzeHandlers.analyze, requireAuth: true },
    aiportfolio: { handler: analyzeHandlers.analyze, requireAuth: true },
};

const actionHandlers: Record<string, { handler: RouteHandler; requireAuth?: boolean }> = {
    help: { handler: authHandlers.help },
    logout: { handler: authHandlers.logout },
    me: { handler: authHandlers.me, requireAuth: true },
    holdings: { handler: portfolioHandlers.holdings, requireAuth: true },
    pfsnapshot: { handler: portfolioSnapshotHandlers.portfolioSnapshot, requireAuth: true },
    positions: { handler: portfolioHandlers.positions, requireAuth: true },
    balance: { handler: portfolioHandlers.balance, requireAuth: true },
    orders: { handler: orderHandlers.listOrders, requireAuth: true },
    mfholdings: { handler: mfHandlers.mfHoldings, requireAuth: true },
    mforders: { handler: mfHandlers.mfOrders, requireAuth: true },
    mfsips: { handler: mfHandlers.mfSips, requireAuth: true },
};

async function withAuth(ctx: BotContext, route: { handler: RouteHandler; requireAuth?: boolean }) {
    if (!route.requireAuth) {
        return route.handler(ctx);
    }

    return authMiddleware.requireAuth(ctx, async () => {
        await route.handler(ctx);
    });
}

export async function dispatchCommand(name: string, ctx: BotContext) {
    const route = commandHandlers[name];
    if (!route) {
        return ctx.reply(`Unsupported command: ${name}`);
    }

    return withAuth(ctx, route);
}

export async function dispatchAction(name: string, ctx: BotContext) {
    const route = actionHandlers[name];
    if (!route) {
        return ctx.reply(`Unsupported action: ${name}`);
    }

    return withAuth(ctx, route);
}

export function getRouteCommandNames() {
    return Object.keys(commandHandlers);
}

export function getRouteActionNames() {
    return Object.keys(actionHandlers);
}
