import type { AiAnalysisResult, HoldingRecord, MfHoldingRecord, PortfolioSummary, PositionRecord, PositionsResponse } from '../types/kite';

import type KiteClient from '../kite/client';
import geminiClient from './geminiClient';

const { getGeminiClient } = geminiClient;

const SECTOR_MAP: Record<string, string> = {
    INFY: 'IT',
    TCS: 'IT',
    WIPRO: 'IT',
    HCLTECH: 'IT',
    TECHM: 'IT',
    LTIM: 'IT',
    MPHASIS: 'IT',
    COFORGE: 'IT',
    HDFCBANK: 'Banking',
    ICICIBANK: 'Banking',
    KOTAKBANK: 'Banking',
    SBIN: 'Banking',
    AXISBANK: 'Banking',
    INDUSINDBK: 'Banking',
    BAJFINANCE: 'Financial Services',
    BAJAJFINSV: 'Financial Services',
    HDFC: 'Financial Services',
    SUNPHARMA: 'Pharma',
    DRREDDY: 'Pharma',
    CIPLA: 'Pharma',
    DIVISLAB: 'Pharma',
    APOLLOHOSP: 'Pharma',
    TATAMOTORS: 'Auto',
    MARUTI: 'Auto',
    'M&M': 'Auto',
    'BAJAJ-AUTO': 'Auto',
    HEROMOTOCO: 'Auto',
    EICHERMOT: 'Auto',
    HINDUNILVR: 'FMCG',
    ITC: 'FMCG',
    NESTLEIND: 'FMCG',
    BRITANNIA: 'FMCG',
    DABUR: 'FMCG',
    TATACONSUM: 'FMCG',
    RELIANCE: 'Energy',
    ONGC: 'Energy',
    BPCL: 'Energy',
    IOC: 'Energy',
    NTPC: 'Energy',
    POWERGRID: 'Energy',
    TATASTEEL: 'Metals',
    JSWSTEEL: 'Metals',
    HINDALCO: 'Metals',
    VEDL: 'Metals',
    COALINDIA: 'Metals',
    BHARTIARTL: 'Telecom',
    IDEA: 'Telecom',
    ULTRACEMCO: 'Cement',
    GRASIM: 'Cement',
    SHREECEM: 'Cement',
    AMBUJACEM: 'Cement',
    LT: 'Infrastructure',
    ADANIENT: 'Infrastructure',
    ADANIPORTS: 'Infrastructure',
};

function getSector(symbol: string) {
    const cleanSymbol = symbol.replace(/^(NSE:|BSE:)/, '');
    return SECTOR_MAP[cleanSymbol] || 'Other';
}

function normalizeHoldings(holdings: HoldingRecord[]) {
    if (!holdings || !Array.isArray(holdings)) return [];

    return holdings.map(holding => ({
        type: 'equity',
        symbol: holding.tradingsymbol,
        exchange: holding.exchange || 'NSE',
        quantity: (holding.realised_quantity || 0) + (holding.t1_quantity || 0),
        avg_price: holding.average_price || 0,
        current_price: holding.last_price || 0,
        market_value: ((holding.realised_quantity || 0) + (holding.t1_quantity || 0)) * (holding.last_price || 0),
        pnl: holding.pnl || ((holding.realised_quantity || 0) + (holding.t1_quantity || 0)) * ((holding.last_price || 0) - (holding.average_price || 0)),
        sector: getSector(holding.tradingsymbol || ''),
    }));
}

function normalizePositions(positions: PositionsResponse) {
    if (!positions || !positions.net || !Array.isArray(positions.net)) return [];

    return positions.net
        .filter(position => position.quantity !== 0)
        .map((position: PositionRecord) => ({
            type: 'position',
            symbol: position.tradingsymbol,
            product: position.product,
            quantity: position.quantity,
            exposure: Math.abs(position.quantity * (position.last_price || 0)),
            pnl: position.pnl || 0,
        }));
}

function categorizeByFundName(fundName: string) {
    const name = fundName.toLowerCase();

    if (name.includes('large cap') || name.includes('largecap') || name.includes('bluechip')) return 'Large Cap';
    if (name.includes('mid cap') || name.includes('midcap')) return 'Mid Cap';
    if (name.includes('small cap') || name.includes('smallcap')) return 'Small Cap';
    if (name.includes('flexi') || name.includes('flexible')) return 'Flexi Cap';
    if (name.includes('multi cap') || name.includes('multicap')) return 'Multi Cap';
    if (name.includes('elss') || name.includes('tax')) return 'ELSS';
    if (name.includes('index') || name.includes('nifty') || name.includes('sensex')) return 'Index Fund';
    if (name.includes('debt') || name.includes('bond') || name.includes('income')) return 'Debt';
    if (name.includes('liquid') || name.includes('money market')) return 'Liquid';
    if (name.includes('hybrid') || name.includes('balanced') || name.includes('advantage')) return 'Hybrid';

    return 'Other';
}

function normalizeMfHoldings(mfHoldings: MfHoldingRecord[]) {
    if (!mfHoldings || !Array.isArray(mfHoldings)) return [];

    return mfHoldings.map(holding => {
        const investedValue = holding.average_price * holding.quantity;
        const currentValue = holding.last_price * holding.quantity;

        return {
            type: 'mutual_fund',
            fund_name: holding.fund,
            tradingsymbol: holding.tradingsymbol,
            category: categorizeByFundName(holding.fund),
            units: holding.quantity,
            invested_value: investedValue,
            current_value: currentValue,
            pnl: currentValue - investedValue,
        };
    });
}

async function aggregatePortfolio(kiteClient: KiteClient) {
    const [holdings, positions, mfHoldings] = await Promise.all([
        kiteClient.getHoldings().catch(() => [] as HoldingRecord[]),
        kiteClient.getPositions().catch(() => ({ net: [] }) as PositionsResponse),
        kiteClient.getMfHoldings().catch(() => [] as MfHoldingRecord[]),
    ]);

    const normalizedHoldings = normalizeHoldings(holdings as HoldingRecord[]);
    const normalizedPositions = normalizePositions(positions as PositionsResponse);
    const normalizedMfHoldings = normalizeMfHoldings(mfHoldings as MfHoldingRecord[]);

    const equityValue = normalizedHoldings.reduce((sum, holding) => sum + holding.market_value, 0);
    const positionsExposure = normalizedPositions.reduce((sum, position) => sum + position.exposure, 0);
    const mfValue = normalizedMfHoldings.reduce((sum, holding) => sum + holding.current_value, 0);
    const totalValue = equityValue + mfValue;

    const equityPnL = normalizedHoldings.reduce((sum, holding) => sum + holding.pnl, 0);
    const positionsPnL = normalizedPositions.reduce((sum, position) => sum + position.pnl, 0);
    const mfPnL = normalizedMfHoldings.reduce((sum, holding) => sum + holding.pnl, 0);
    const totalPnL = equityPnL + mfPnL;

    const equityInvested = normalizedHoldings.reduce((sum, holding) => sum + holding.avg_price * holding.quantity, 0);
    const mfInvested = normalizedMfHoldings.reduce((sum, holding) => sum + holding.invested_value, 0);
    const totalInvested = equityInvested + mfInvested;

    const sectorExposure: Record<string, number> = {};
    normalizedHoldings.forEach(holding => {
        sectorExposure[holding.sector] = (sectorExposure[holding.sector] || 0) + holding.market_value;
    });

    const mfCategoryExposure: Record<string, number> = {};
    normalizedMfHoldings.forEach(holding => {
        mfCategoryExposure[holding.category] = (mfCategoryExposure[holding.category] || 0) + holding.current_value;
    });

    const allHoldings = [
        ...normalizedHoldings.map(holding => ({ name: holding.symbol, value: holding.market_value, type: 'equity' })),
        ...normalizedMfHoldings.map(holding => ({ name: holding.fund_name, value: holding.current_value, type: 'mf' })),
    ].sort((left, right) => right.value - left.value);

    const top5Holdings = allHoldings.slice(0, 5);
    const top3Value = allHoldings.slice(0, 3).reduce((sum, holding) => sum + holding.value, 0);
    const topHoldingValue = allHoldings.length > 0 ? allHoldings[0].value : 0;

    const portfolio_summary: PortfolioSummary = {
        total_value: totalValue,
        total_invested: totalInvested,
        equity_value: equityValue,
        mf_value: mfValue,
        equity_allocation_percent: totalValue > 0 ? Math.round((equityValue / totalValue) * 100) : 0,
        mutual_fund_allocation_percent: totalValue > 0 ? Math.round((mfValue / totalValue) * 100) : 0,
        unrealized_pnl: totalPnL,
        unrealized_pnl_percent: totalInvested > 0 ? parseFloat(((totalPnL / totalInvested) * 100).toFixed(2)) : 0,
        positions_exposure: positionsExposure,
        positions_pnl: positionsPnL,
        top_holding_concentration_percent: totalValue > 0 ? Math.round((topHoldingValue / totalValue) * 100) : 0,
        top_3_concentration_percent: totalValue > 0 ? Math.round((top3Value / totalValue) * 100) : 0,
        holdings_count: normalizedHoldings.length + normalizedMfHoldings.length,
    };

    return {
        portfolio_summary,
        sector_exposure: sectorExposure,
        mf_category_exposure: mfCategoryExposure,
        top_5_holdings: allHoldings.slice(0, 5),
        holdings: normalizedHoldings,
        positions: normalizedPositions,
        mutual_funds: normalizedMfHoldings,
    };
}

function buildGeminiPrompt(aggregatedData: Awaited<ReturnType<typeof aggregatePortfolio>>, depth = 'brief') {
    return {
        ...aggregatedData,
        analysis_request: {
            depth,
            focus_areas: ['diversification', 'risk', 'allocation', 'concentration', 'improvements'],
        },
    };
}

async function analyzePortfolio(kiteClient: KiteClient, depth = 'brief') {
    const gemini = getGeminiClient();

    if (!gemini.isEnabled()) {
        throw new Error('AI analysis is not available. Gemini API key not configured.');
    }

    const aggregatedData = await aggregatePortfolio(kiteClient);
    if (aggregatedData.portfolio_summary.holdings_count === 0) {
        return { isEmpty: true, message: 'No holdings found. Add some investments to get AI-powered analysis.' };
    }

    const promptData = buildGeminiPrompt(aggregatedData, depth);
    const analysis = (await gemini.analyzePortfolio(promptData)) as AiAnalysisResult;

    return {
        isEmpty: false,
        portfolioSummary: aggregatedData.portfolio_summary,
        analysis,
    };
}

async function askPortfolioQuestion(kiteClient: KiteClient, question: string) {
    const gemini = getGeminiClient();

    if (!gemini.isEnabled()) {
        throw new Error('AI analysis is not available. Gemini API key not configured.');
    }

    const aggregatedData = await aggregatePortfolio(kiteClient);
    if (aggregatedData.portfolio_summary.holdings_count === 0) {
        return { isEmpty: true, message: 'No holdings found. Add some investments first.' };
    }

    const response = await gemini.askQuestion(aggregatedData, question);

    return {
        isEmpty: false,
        portfolioSummary: aggregatedData.portfolio_summary,
        answer: response,
    };
}

export = {
    aggregatePortfolio,
    analyzePortfolio,
    askPortfolioQuestion,
    normalizeHoldings,
    normalizePositions,
    normalizeMfHoldings,
};
