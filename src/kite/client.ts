import axios, { type AxiosInstance } from 'axios';
import crypto from 'crypto';
import qs from 'querystring';
import { gunzipSync } from 'zlib';
import { config } from '../config';
import type { HistoricalDataOptions, HistoricalDataResponse, KiteApiEnvelope, KiteApiError, KiteSessionResponse, KiteUserProfile, PlaceOrderParams, QuoteMap } from '../types/kite';

class KiteClient {
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private accessToken: string | null;
    private readonly baseUrl: string;
    private readonly client: AxiosInstance;

    constructor(accessToken: string | null = null) {
        this.apiKey = config.kiteApiKey;
        this.apiSecret = config.kiteApiSecret;
        this.accessToken = accessToken;
        this.baseUrl = 'https://api.kite.trade';

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'X-Kite-Version': '3',
            },
        });

        this.client.interceptors.request.use(requestConfig => {
            if (this.accessToken) {
                requestConfig.headers.Authorization = `token ${this.apiKey}:${this.accessToken}`;
            }
            return requestConfig;
        });

        this.client.interceptors.response.use(
            response => response.data,
            error => {
                if (error.response && error.response.data) {
                    const { message, error_type: errorType } = error.response.data as KiteApiEnvelope<never>;
                    const err = new Error(message || 'Unknown Kite API Error') as KiteApiError;
                    err.type = errorType;
                    err.statusCode = error.response.status;
                    throw err;
                }

                throw error;
            },
        );
    }

    setAccessToken(token: string | null) {
        this.accessToken = token;
    }

    generateLoginUrl() {
        return `https://kite.trade/connect/login?api_key=${this.apiKey}&v=3`;
    }

    async generateSession(requestToken: string): Promise<KiteSessionResponse> {
        const checksum = crypto
            .createHash('sha256')
            .update(this.apiKey + requestToken + this.apiSecret)
            .digest('hex');

        const payload = qs.stringify({
            api_key: this.apiKey,
            request_token: requestToken,
            checksum,
        });

        const response = (await this.client.post('/session/token', payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })) as KiteApiEnvelope<KiteSessionResponse>;

        if (response.status !== 'success') {
            throw new Error('Session generation failed');
        }

        return response.data;
    }

    async getProfile(): Promise<KiteUserProfile> {
        return this._get('/user/profile');
    }

    async getHoldings() {
        return this._get('/portfolio/holdings');
    }

    async getPositions() {
        return this._get('/portfolio/positions');
    }

    async getMargins() {
        return this._get('/user/margins');
    }

    async getSegmentMargins(segment: string) {
        return this._get(`/user/margins/${segment}`);
    }

    async placeOrder(params: PlaceOrderParams) {
        const payload = qs.stringify(params as unknown as Record<string, string | number | boolean | null | undefined>);
        return this._post(`/orders/${params.variety || 'regular'}`, payload);
    }

    async getOrders() {
        return this._get('/orders');
    }

    async getOrderHistory(orderId: string) {
        return this._get(`/orders/${orderId}`);
    }

    async getQuote(instruments: string[]): Promise<QuoteMap> {
        return this._getQuoteData('/quote', instruments);
    }

    async getOhlc(instruments: string[]): Promise<QuoteMap> {
        return this._getQuoteData('/quote/ohlc', instruments);
    }

    async getLtp(instruments: string[]): Promise<QuoteMap> {
        return this._getQuoteData('/quote/ltp', instruments);
    }

    async getHistoricalData(instrumentToken: number | string, interval: string, options: HistoricalDataOptions): Promise<HistoricalDataResponse> {
        if (!instrumentToken) {
            throw new Error('instrument_token is required.');
        }

        if (!interval) {
            throw new Error('interval is required.');
        }

        const params = new URLSearchParams();
        params.append('from', options.from);
        params.append('to', options.to);

        if (options.continuous !== undefined) {
            params.append('continuous', String(options.continuous));
        }

        if (options.oi !== undefined) {
            params.append('oi', String(options.oi));
        }

        const endpoint = `/instruments/historical/${instrumentToken}/${interval}?${params.toString()}`;
        const response = (await this.client.get(endpoint)) as KiteApiEnvelope<HistoricalDataResponse>;
        return response.data;
    }

    /**
     * Full tradable instruments dump as CSV (Kite gzips the response; decoded here).
     * @see https://kite.trade/docs/connect/v3/market-quotes/#instruments
     * @param exchange Optional exchange segment, e.g. NSE — maps to GET /instruments/:exchange
     */
    async getInstruments(exchange?: string): Promise<string> {
        const path = exchange ? `/instruments/${encodeURIComponent(exchange)}` : '/instruments';
        const data = (await this.client.get(path, {
            responseType: 'arraybuffer',
        })) as unknown as ArrayBuffer;

        let buf = Buffer.from(data);
        if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
            buf = gunzipSync(buf);
        }
        return buf.toString('utf-8');
    }

    async getMfHoldings() {
        return this._get('/mf/holdings');
    }

    async getMfOrders() {
        return this._get('/mf/orders');
    }

    async getMfOrder(orderId: string) {
        return this._get(`/mf/orders/${orderId}`);
    }

    async getMfSips() {
        return this._get('/mf/sips');
    }

    /**
     * Full mutual fund instruments dump as CSV (Kite may gzip the response; decoded here).
     * @see https://kite.trade/docs/connect/v3/mf/#retrieving-list-of-mutual-fund-instruments
     */
    async getMfInstruments(): Promise<string> {
        const data = (await this.client.get('/mf/instruments', {
            responseType: 'arraybuffer',
        })) as unknown as ArrayBuffer;

        let buf = Buffer.from(data);
        if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
            buf = gunzipSync(buf);
        }
        return buf.toString('utf-8');
    }

    private async _get<T>(endpoint: string): Promise<T> {
        const response = (await this.client.get(endpoint)) as KiteApiEnvelope<T>;
        return response.data;
    }

    private async _post<T>(endpoint: string, data: string): Promise<T> {
        const response = (await this.client.post(endpoint, data, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })) as KiteApiEnvelope<T>;

        return response.data;
    }

    private async _getQuoteData(endpoint: string, instruments: string[]): Promise<QuoteMap> {
        if (!Array.isArray(instruments) || instruments.length === 0) {
            throw new Error('At least one instrument is required.');
        }

        const params = new URLSearchParams();
        instruments.forEach(instrument => params.append('i', instrument));

        const response = (await this.client.get(`${endpoint}?${params.toString()}`)) as KiteApiEnvelope<QuoteMap>;
        return response.data;
    }
}

export = KiteClient;
