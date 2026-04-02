import { Context } from 'telegraf';
import type KiteClient from '../kite/client';
import type { SessionRecord } from './storage';
import type { Update } from 'telegraf/types';

export interface BotContext<U extends Update = Update> extends Context<U> {
    sessionData?: SessionRecord | null;
    kite?: KiteClient | null;
}

/** Telegraf middleware / composer `next` callback. */
export type NextFn = () => Promise<void>;
