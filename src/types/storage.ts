import type { BotPlatform } from './bot';

export interface SessionRecord {
    actorId: string;
    platform: BotPlatform;
    platformUserId: string;
    requestToken: string | null;
    accessToken: string | null;
    publicToken: string | null;
    kiteUserId: string | null;
    userName: string | null;
    avatarUrl: string | null;
    loginTime: number | null;
    expiresAt: number | null;
}

export interface StoredSessionInput {
    access_token: string | null;
    public_token: string | null;
    user_id: string | null;
    user_name: string | null;
    avatar_url: string | null;
    login_time?: number | null;
    request_token?: string | null;
    expires_at?: number | null;
}

export interface AiCreditsRecord {
    actorId: string;
    platform: BotPlatform;
    platformUserId: string;
    credits: number;
    totalUsed: number;
    createdAt: number | null;
    updatedAt: number | null;
}

export interface WatchlistRecord {
    actorId: string;
    platform: BotPlatform;
    platformUserId: string;
    instrument: string;
    createdAt: number;
}

export interface PortfolioSnapshotInput {
    mfInvested: number;
    mfCurrent: number;
    eqInvested: number;
    eqCurrent: number;
}

export interface PortfolioSnapshotRecord extends PortfolioSnapshotInput {
    id: number;
    actorId: string;
    platform: BotPlatform;
    platformUserId: string;
    createdAt: number;
}
