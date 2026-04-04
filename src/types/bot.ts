import type KiteClient from '../kite/client';
import type { SessionRecord } from './storage';

export type BotPlatform = 'telegram' | 'discord';

export interface BotUser {
    id: string | number;
    username?: string;
    first_name?: string;
}

export interface BotChat {
    type?: string;
}

export interface BotTextMessage {
    text?: string;
}

export interface BotAttachmentInput {
    source: Buffer;
    filename: string;
}

export interface BotReplyMarkupButton {
    text: string;
    callback_data: string;
}

export interface BotReplyOptions {
    parse_mode?: any;
    caption?: string;
    reply_markup?: {
        inline_keyboard?: BotReplyMarkupButton[][];
    };
}

export interface BotContext {
    platform?: BotPlatform;
    from?: BotUser;
    chat?: BotChat;
    message?: BotTextMessage;
    sessionData?: SessionRecord | null;
    kite?: KiteClient | null;
    updateType?: string;
    reply(text: any, extra?: any): Promise<unknown> | unknown;
    replyWithPhoto(file: any, extra?: any): Promise<unknown> | unknown;
    replyWithDocument(file: any, extra?: any): Promise<unknown> | unknown;
}

export type NextFn = () => Promise<void>;
