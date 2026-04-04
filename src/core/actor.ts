import type { BotContext, BotPlatform } from '../types/bot';

export function normalizePlatform(platform?: string): BotPlatform {
    return platform === 'discord' ? 'discord' : 'telegram';
}

export function makeActorId(platform: BotPlatform, platformUserId: string | number): string {
    return `${platform}:${String(platformUserId)}`;
}

export function getPlatformUserId(ctx: BotContext): string | null {
    if (!ctx.from?.id) {
        return null;
    }

    return String(ctx.from.id);
}

export function getActorFromContext(ctx: BotContext) {
    const platform = normalizePlatform(ctx.platform);
    const platformUserId = getPlatformUserId(ctx);

    if (!platformUserId) {
        return null;
    }

    return {
        actorId: makeActorId(platform, platformUserId),
        platform,
        platformUserId,
    };
}
