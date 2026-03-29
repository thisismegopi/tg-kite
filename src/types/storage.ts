export interface SessionRecord {
    telegramUserId: string;
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
    telegramUserId: string;
    credits: number;
    totalUsed: number;
    createdAt: number | null;
    updatedAt: number | null;
}

export interface WatchlistRecord {
    instrument: string;
    createdAt: number;
}
