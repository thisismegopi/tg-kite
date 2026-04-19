import { KiteConnect } from 'kiteconnect';
import type { Connect, Exchanges, HistoricalData, Instrument, MFInstrument, SessionData } from 'kiteconnect';
import { config } from '../config';
import type { HistoricalDataOptions, HistoricalDataResponse, KiteSessionResponse, KiteUserProfile, PlaceOrderParams, QuoteMap } from '../types/kite';

type CsvValue = string | number | boolean | Date | null | undefined;

const INSTRUMENT_CSV_COLUMNS = [
    'instrument_token',
    'exchange_token',
    'tradingsymbol',
    'name',
    'last_price',
    'expiry',
    'strike',
    'tick_size',
    'lot_size',
    'instrument_type',
    'segment',
    'exchange',
];

const MF_INSTRUMENT_CSV_COLUMNS = [
    'tradingsymbol',
    'amc',
    'name',
    'purchase_allowed',
    'redemption_allowed',
    'minimum_purchase_amount',
    'purchase_amount_multiplier',
    'minimum_additional_purchase_amount',
    'minimum_redemption_quantity',
    'redemption_quantity_multiplier',
    'dividend_type',
    'scheme_type',
    'plan',
    'settlement_type',
    'last_price',
    'last_price_date',
];

function toKiteError(err: unknown): Error {
    if (err instanceof Error) {
        return err;
    }

    if (err && typeof err === 'object') {
        const payload = err as { message?: string; error_type?: string; statusCode?: number };
        const kiteError = new Error(payload.message || 'Unknown Kite API Error') as Error & { type?: string; statusCode?: number };
        kiteError.type = payload.error_type;
        kiteError.statusCode = payload.statusCode;
        return kiteError;
    }

    return new Error(String(err));
}

function dateToApiDate(value: Date) {
    return value.toISOString().slice(0, 10);
}

function formatCsvValue(value: CsvValue) {
    if (value === null || value === undefined) {
        return '';
    }

    const text = value instanceof Date ? dateToApiDate(value) : String(value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}

function toCsv<T extends Record<string, unknown>>(rows: T[], columns: string[]) {
    return [
        columns.join(','),
        ...rows.map(row => columns.map(column => formatCsvValue(row[column] as CsvValue)).join(',')),
    ].join('\n');
}

function toLoginTime(value: SessionData['login_time']) {
    if (!value) {
        return null;
    }

    const timestamp = new Date(String(value)).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
}

function toHistoricalCandle(candle: HistoricalData): [string, number, number, number, number, number?, number?] {
    const row: [string, number, number, number, number, number?, number?] = [
        candle.date instanceof Date ? candle.date.toISOString() : String(candle.date),
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume,
    ];

    if (candle.oi !== undefined) {
        row.push(candle.oi);
    }

    return row;
}

class KiteClient {
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private client: Connect;

    constructor(accessToken: string | null = null) {
        this.apiKey = config.kiteApiKey;
        this.apiSecret = config.kiteApiSecret;
        this.client = new KiteConnect({
            api_key: this.apiKey,
            access_token: accessToken || undefined,
        });
    }

    setAccessToken(token: string | null) {
        if (token) {
            this.client.setAccessToken(token);
            return;
        }

        this.client = new KiteConnect({ api_key: this.apiKey });
    }

    generateLoginUrl() {
        return this.client.getLoginURL();
    }

    async generateSession(requestToken: string): Promise<KiteSessionResponse> {
        try {
            const session = await this.client.generateSession(requestToken, this.apiSecret);

            return {
                access_token: session.access_token,
                public_token: session.public_token,
                user_id: session.user_id,
                user_name: session.user_name,
                avatar_url: session.avatar_url || null,
                login_time: toLoginTime(session.login_time),
            };
        } catch (err) {
            throw toKiteError(err);
        }
    }

    async getProfile(): Promise<KiteUserProfile> {
        return this.call(() => this.client.getProfile());
    }

    async getHoldings() {
        return this.call(() => this.client.getHoldings());
    }

    async getPositions() {
        return this.call(() => this.client.getPositions());
    }

    async getMargins() {
        return this.call(() => this.client.getMargins());
    }

    async getSegmentMargins(segment: string) {
        return this.call(() => this.client.getMargins(segment as 'equity' | 'commodity'));
    }

    async placeOrder(params: PlaceOrderParams) {
        const { variety = 'regular', ...orderParams } = params;
        return this.call(() => this.client.placeOrder(variety as Connect['VARIETY_REGULAR'], orderParams as Parameters<Connect['placeOrder']>[1]));
    }

    async getOrders() {
        return this.call(() => this.client.getOrders());
    }

    async getOrderHistory(orderId: string) {
        return this.call(() => this.client.getOrderHistory(orderId));
    }

    async getQuote(instruments: string[]): Promise<QuoteMap> {
        return this.call(() => this.client.getQuote(this.requireInstruments(instruments))) as Promise<QuoteMap>;
    }

    async getOhlc(instruments: string[]): Promise<QuoteMap> {
        return this.call(() => this.client.getOHLC(this.requireInstruments(instruments))) as Promise<QuoteMap>;
    }

    async getLtp(instruments: string[]): Promise<QuoteMap> {
        return this.call(() => this.client.getLTP(this.requireInstruments(instruments))) as Promise<QuoteMap>;
    }

    async getHistoricalData(instrumentToken: number | string, interval: string, options: HistoricalDataOptions): Promise<HistoricalDataResponse> {
        if (!instrumentToken) {
            throw new Error('instrument_token is required.');
        }

        if (!interval) {
            throw new Error('interval is required.');
        }

        const candles = await this.call(() => this.client.getHistoricalData(instrumentToken, interval as Parameters<Connect['getHistoricalData']>[1], options.from, options.to, Boolean(options.continuous), Boolean(options.oi)));
        return { candles: candles.map(toHistoricalCandle) };
    }

    /**
     * Full tradable instruments dump, exposed as CSV to preserve the bot command contract.
     */
    async getInstruments(exchange?: string): Promise<string> {
        const instruments = await this.call(() => this.client.getInstruments(exchange as Exchanges | undefined));
        return toCsv(instruments as unknown as Instrument[], INSTRUMENT_CSV_COLUMNS);
    }

    async getMfHoldings() {
        return this.call(() => this.client.getMFHoldings());
    }

    async getMfOrders(): Promise<unknown[]> {
        return this.call(() => this.client.getMFOrders()) as Promise<unknown[]>;
    }

    async getMfOrder(orderId: string): Promise<unknown> {
        return this.call(() => this.client.getMFOrders(orderId)) as Promise<unknown>;
    }

    async getMfSips(): Promise<unknown[]> {
        return this.call(() => this.client.getMFSIPS()) as Promise<unknown[]>;
    }

    /**
     * Full mutual fund instruments dump, exposed as CSV to preserve the bot command contract.
     */
    async getMfInstruments(): Promise<string> {
        const instruments = await this.call(() => this.client.getMFInstruments());
        return toCsv(instruments as unknown as MFInstrument[], MF_INSTRUMENT_CSV_COLUMNS);
    }

    private requireInstruments(instruments: string[]) {
        if (!Array.isArray(instruments) || instruments.length === 0) {
            throw new Error('At least one instrument is required.');
        }

        return instruments;
    }

    private async call<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (err) {
            throw toKiteError(err);
        }
    }
}

export = KiteClient;
