const db = require('../../storage/db');
const KiteClient = require('../../kite/client');

/**
 * Middleware to check if user has a valid session.
 * If yes, initializes ctx.kite with a KiteClient instance.
 */
const authMiddleware = async (ctx, next) => {
  if (!ctx.from) return next();

  const telegramUserId = ctx.from.id;
  const session = db.getUserSession(telegramUserId);

  ctx.sessionData = session; // Attach raw session data

  if (session && session.access_token) {
    ctx.kite = new KiteClient(session.access_token);
  } else {
    ctx.kite = null;
  }

  return next();
};

/**
 * Guard middleware: Blocks access if not authenticated.
 */
const requireAuth = (ctx, next) => {
  if (!ctx.kite) {
    return ctx.reply('⚠️ You are not logged in.\nPlease run /login to connect your Kite account.');
  }
  return next();
};

module.exports = {
  authMiddleware,
  requireAuth
};

