import { BotContext, NextFn } from '../../types/bot';

import { getActorFromContext } from '../../core/actor';
import KiteClient from '../../kite/client';
import db from '../../storage/db';

const authMiddleware = async (ctx: BotContext, next: NextFn) => {
    if (ctx.chat?.type !== 'private') {
        return await ctx.reply('Not a private chat!');
    }
    const actor = getActorFromContext(ctx);
    if (!actor) return next();

    const session = db.getUserSession(actor.actorId);

    ctx.sessionData = session;

    if (session && session.accessToken) {
        ctx.kite = new KiteClient(session.accessToken);
        try {
            await ctx.kite.getProfile();
        } catch (error) {
            db.deleteUserSession(actor.actorId);
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
