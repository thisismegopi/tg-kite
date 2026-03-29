import KiteClient from '../../kite/client';
import db from '../../storage/db';

const authMiddleware = async (ctx: any, next: any) => {
    if (!ctx.from) return next();

    const telegramUserId = ctx.from.id;
    const session = db.getUserSession(telegramUserId);

    ctx.sessionData = session;

    if (session && session.accessToken) {
        ctx.kite = new (KiteClient as any)(session.accessToken);
    } else {
        ctx.kite = null;
    }

    return next();
};

const requireAuth = (ctx: any, next: any) => {
    if (!ctx.kite) {
        return ctx.reply('You are not logged in.\nPlease run /login to connect your Kite account.');
    }
    return next();
};

export = {
    authMiddleware,
    requireAuth,
};
