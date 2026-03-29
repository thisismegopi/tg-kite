import type KiteClient from "../kite/client";
import type { SessionRecord } from "./storage";

export interface BotContext {
    from?: {
        id: number | string;
    };
    message?: {
        text?: string;
    };
    updateType?: string;
    sessionData?: SessionRecord | null;
    kite?: KiteClient | null;
    reply: (text: string, extra?: unknown) => Promise<unknown> | unknown;
    replyWithPhoto: (photo: unknown, extra?: unknown) => Promise<unknown> | unknown;
}

export type NextFn = () => Promise<unknown> | unknown;
