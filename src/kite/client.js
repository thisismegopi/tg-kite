const axios = require('axios');
const crypto = require('crypto');
const qs = require('querystring');
const config = require('../config');

class KiteClient {
    constructor(accessToken = null) {
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

        // Interceptor to inject Authorization header
        this.client.interceptors.request.use(reqConfig => {
            if (this.accessToken) {
                reqConfig.headers['Authorization'] = `token ${this.apiKey}:${this.accessToken}`;
            }
            return reqConfig;
        });

        // Interceptor to handle errors uniformly
        this.client.interceptors.response.use(
            response => response.data,
            error => {
                if (error.response && error.response.data) {
                    // Kite sends structured errors: { status: "error", message: "...", error_type: "..." }
                    const { message, error_type } = error.response.data;
                    const err = new Error(message || 'Unknown Kite API Error');
                    err.type = error_type;
                    err.statusCode = error.response.status;
                    throw err;
                }
                throw error;
            },
        );
    }

    setAccessToken(token) {
        this.accessToken = token;
    }

    // --- Auth ---

    generateLoginUrl() {
        return `https://kite.trade/connect/login?api_key=${this.apiKey}&v=3`;
    }

    async generateSession(requestToken) {
        // Checksum = SHA256 (api_key + request_token + api_secret)
        const checksum = crypto
            .createHash('sha256')
            .update(this.apiKey + requestToken + this.apiSecret)
            .digest('hex');

        const payload = qs.stringify({
            api_key: this.apiKey,
            request_token: requestToken,
            checksum: checksum,
        });

        try {
            const response = await this.client.post('/session/token', payload, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            // response.data is actually returned due to interceptor, which contains { status: 'success', data: { ... } }
            // But based on docs, successful response wrapper is:
            // { "status": "success", "data": { "user_type": "...", "email": "...", ... } }
            // My interceptor returns response.data directly.

            if (response.status === 'success') {
                return response.data;
            } else {
                throw new Error('Session generation failed');
            }
        } catch (error) {
            throw error;
        }
    }

    // --- User / Portfolio ---

    async getProfile() {
        return this._get('/user/profile');
    }

    async getHoldings() {
        return this._get('/portfolio/holdings');
    }

    async getPositions() {
        return this._get('/portfolio/positions');
    }

    async getMargins() {
        // Returns funds/margins
        return this._get('/user/margins');
    }

    async getSegmentMargins(segment) {
        // segment: 'equity' or 'commodity'
        return this._get(`/user/margins/${segment}`);
    }

    // --- Orders ---

    async placeOrder(params) {
        // params: { exchange, tradingsymbol, transaction_type, quantity, product, order_type, price, ... }
        const payload = qs.stringify(params);
        return this._post(`/orders/${params.variety || 'regular'}`, payload);
    }

    async getOrders() {
        return this._get('/orders');
    }

    async getOrderHistory(orderId) {
        return this._get(`/orders/${orderId}`);
    }

    // --- Helpers ---

    async _get(endpoint) {
        const res = await this.client.get(endpoint);
        return res.data;
    }

    async _post(endpoint, data) {
        const res = await this.client.post(endpoint, data, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return res.data;
    }
}

module.exports = KiteClient;
