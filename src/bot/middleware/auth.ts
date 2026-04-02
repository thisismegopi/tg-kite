import { BotContext, NextFn } from '../../types/bot';

import KiteClient from '../../kite/client';
import db from '../../storage/db';

const authMiddleware = async (ctx: BotContext, next: NextFn) => {
    if (!ctx.from) return next();

    const telegramUserId = ctx.from.id;
    const session = db.getUserSession(telegramUserId);

    ctx.sessionData = session;

    if (session && session.accessToken) {
        ctx.kite = new KiteClient(session.accessToken);
        try {
            await ctx.kite.getProfile();
        } catch (error) {
            db.deleteUserSession(ctx.from.id);
            ctx.kite = null;
        }
    } else {
        ctx.kite = null;
    }

    return await next();
};

const requireAuth = async (ctx: BotContext, next: NextFn) => {
    if (!ctx.kite) {
        return ctx.reply('You are not logged in.\nPlease run /login to connect your Kite account.');
    }
    return await next();
};

export = {
    authMiddleware,
    requireAuth,
};
