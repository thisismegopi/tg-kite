export interface KiteApiError extends Error {
    type?: string;
    statusCode?: number;
}

export interface KiteSessionResponse {
    access_token: string;
    public_token: string;
    user_id: string;
    user_name: string;
    avatar_url?: string | null;
    login_time?: number | null;
}

export interface QuoteOhlc {
    open?: number;
    high?: number;
    low?: number;
    close?: number;
}

export interface QuoteData {
    instrument_token?: number;
    last_price?: number;
    average_price?: number;
    volume?: number;
    buy_quantity?: number;
    sell_quantity?: number;
    net_change?: number;
    ohlc?: QuoteOhlc;
}

export type QuoteMap = Record<string, QuoteData>;

export interface HistoricalDataOptions {
    from: string;
    to: string;
    continuous?: number;
    oi?: number;
}

export interface HistoricalDataResponse {
    candles?: Array<[string, number, number, number, number, number?, number?]>;
}

export interface KiteApiEnvelope<T> {
    status: "success" | "error";
    data: T;
    message?: string;
    error_type?: string;
}

export interface PlaceOrderParams {
    variety?: string;
    exchange: string;
    tradingsymbol: string;
    transaction_type: string;
    quantity: number;
    product: string;
    order_type: string;
    price: number;
    validity: string;
    trigger_price?: number;
}

export interface PlaceOrderResponse {
    order_id: string;
}

export interface OrderRecord {
    order_id: string;
    transaction_type: string;
    tradingsymbol: string;
    quantity: number;
    price?: number;
    status: string;
    order_type?: string;
    filled_quantity?: number;
    average_price?: number;
    status_message?: string;
    product?: string;
}

export interface HoldingRecord {
    tradingsymbol?: string;
    quantity?: number;
    average_price?: number;
    last_price?: number;
    pnl?: number;
    exchange?: string;
}

export interface PositionRecord {
    tradingsymbol: string;
    product: string;
    quantity: number;
    average_price: number;
    last_price?: number;
    pnl: number;
}

export interface PositionsResponse {
    net: PositionRecord[];
}

export interface MarginsResponse {
    equity?: {
        available: { cash: number };
        utilised: { debits: number };
        net: number;
    };
    commodity?: {
        available: { cash: number };
        net: number;
    };
}

export interface MfHoldingRecord {
    fund: string;
    tradingsymbol: string;
    quantity: number;
    average_price: number;
    last_price: number;
    folio?: string;
}

export interface MfOrderRecord {
    order_id: string;
    tradingsymbol: string;
    fund: string;
    status: string;
    transaction_type: string;
    amount: number;
    quantity: number;
    average_price: number;
    order_timestamp?: string;
    status_message?: string;
    variety?: string;
    folio?: string;
}

export interface MfSipRecord {
    fund: string;
    status: string;
    instalment_amount: number;
    frequency: string;
    next_instalment?: string;
    completed_instalments: number;
    pending_instalments: number;
}

export interface MfInstrumentRecord {
    tradingsymbol: string;
    amc: string;
    name: string;
    scheme_type: string;
    plan: string;
    last_price: number;
    minimum_purchase_amount: number;
    purchase_amount_multiplier?: number;
    minimum_additional_purchase_amount?: number;
    minimum_redemption_quantity?: number;
    redemption_quantity_multiplier?: number;
    purchase_allowed?: boolean;
    redemption_allowed?: boolean;
    [key: string]: string | number | boolean | undefined;
}

export interface PortfolioSummary {
    total_value: number;
    total_invested: number;
    equity_value: number;
    mf_value: number;
    equity_allocation_percent: number;
    mutual_fund_allocation_percent: number;
    unrealized_pnl: number;
    unrealized_pnl_percent: number;
    positions_exposure: number;
    positions_pnl: number;
    top_holding_concentration_percent: number;
    top_3_concentration_percent: number;
    holdings_count: number;
}

export interface AiAnalysisResult {
    diversification_score: number;
    risk_profile: string;
    key_insights: string[];
    allocation_analysis?: {
        equity?: string;
        mutual_funds?: string;
        cash?: string;
    };
    risk_analysis?: {
        volatility_risk?: string;
        sector_risk?: string;
        concentration_risk?: string;
    };
    improvement_suggestions: string[];
    disclaimer: string;
}
