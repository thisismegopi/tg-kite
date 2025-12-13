/**
 * Portfolio Analyzer
 * 
 * Aggregates portfolio data from Kite APIs and orchestrates Gemini analysis.
 * Computes derived metrics for better AI insights.
 */

const { getGeminiClient } = require('./geminiClient');

// Sector mapping for common stocks (approximate)
const SECTOR_MAP = {
    // IT
    'INFY': 'IT', 'TCS': 'IT', 'WIPRO': 'IT', 'HCLTECH': 'IT', 'TECHM': 'IT', 'LTIM': 'IT', 'MPHASIS': 'IT', 'COFORGE': 'IT',
    // Banking
    'HDFCBANK': 'Banking', 'ICICIBANK': 'Banking', 'KOTAKBANK': 'Banking', 'SBIN': 'Banking', 'AXISBANK': 'Banking', 'INDUSINDBK': 'Banking',
    // Financial Services
    'BAJFINANCE': 'Financial Services', 'BAJAJFINSV': 'Financial Services', 'HDFC': 'Financial Services',
    // Pharma
    'SUNPHARMA': 'Pharma', 'DRREDDY': 'Pharma', 'CIPLA': 'Pharma', 'DIVISLAB': 'Pharma', 'APOLLOHOSP': 'Pharma',
    // Auto
    'TATAMOTORS': 'Auto', 'MARUTI': 'Auto', 'M&M': 'Auto', 'BAJAJ-AUTO': 'Auto', 'HEROMOTOCO': 'Auto', 'EICHERMOT': 'Auto',
    // FMCG
    'HINDUNILVR': 'FMCG', 'ITC': 'FMCG', 'NESTLEIND': 'FMCG', 'BRITANNIA': 'FMCG', 'DABUR': 'FMCG', 'TATACONSUM': 'FMCG',
    // Energy
    'RELIANCE': 'Energy', 'ONGC': 'Energy', 'BPCL': 'Energy', 'IOC': 'Energy', 'NTPC': 'Energy', 'POWERGRID': 'Energy',
    // Metals
    'TATASTEEL': 'Metals', 'JSWSTEEL': 'Metals', 'HINDALCO': 'Metals', 'VEDL': 'Metals', 'COALINDIA': 'Metals',
    // Telecom
    'BHARTIARTL': 'Telecom', 'IDEA': 'Telecom',
    // Cement
    'ULTRACEMCO': 'Cement', 'GRASIM': 'Cement', 'SHREECEM': 'Cement', 'AMBUJACEM': 'Cement',
    // Infra
    'LT': 'Infrastructure', 'ADANIENT': 'Infrastructure', 'ADANIPORTS': 'Infrastructure'
};

// MF category to asset class mapping
const MF_CATEGORY_MAP = {
    'Large Cap': 'Equity-LargeCap',
    'Multi Cap': 'Equity-MultiCap',
    'Flexi Cap': 'Equity-FlexiCap',
    'Mid Cap': 'Equity-MidCap',
    'Small Cap': 'Equity-SmallCap',
    'ELSS': 'Equity-ELSS',
    'Index Fund': 'Equity-Index',
    'Debt': 'Debt',
    'Liquid': 'Debt-Liquid',
    'Hybrid': 'Hybrid'
};

/**
 * Get sector for a stock symbol
 */
function getSector(symbol) {
    // Clean symbol (remove exchange prefix if present)
    const cleanSymbol = symbol.replace(/^(NSE:|BSE:)/, '');
    return SECTOR_MAP[cleanSymbol] || 'Other';
}

/**
 * Normalize equity holdings
 */
function normalizeHoldings(holdings) {
    if (!holdings || !Array.isArray(holdings)) return [];

    return holdings.map(h => ({
        type: 'equity',
        symbol: h.tradingsymbol,
        exchange: h.exchange || 'NSE',
        quantity: h.quantity,
        avg_price: h.average_price,
        current_price: h.last_price,
        market_value: h.quantity * h.last_price,
        pnl: h.pnl || (h.quantity * (h.last_price - h.average_price)),
        sector: getSector(h.tradingsymbol)
    }));
}

/**
 * Normalize positions
 */
function normalizePositions(positions) {
    if (!positions || !positions.net || !Array.isArray(positions.net)) return [];

    return positions.net
        .filter(p => p.quantity !== 0) // Only include open positions
        .map(p => ({
            type: 'position',
            symbol: p.tradingsymbol,
            product: p.product,
            quantity: p.quantity,
            exposure: Math.abs(p.quantity * p.last_price),
            pnl: p.pnl || 0
        }));
}

/**
 * Normalize mutual fund holdings
 */
function normalizeMfHoldings(mfHoldings) {
    if (!mfHoldings || !Array.isArray(mfHoldings)) return [];

    return mfHoldings.map(h => {
        const investedValue = h.average_price * h.quantity;
        const currentValue = h.last_price * h.quantity;
        
        return {
            type: 'mutual_fund',
            fund_name: h.fund,
            tradingsymbol: h.tradingsymbol,
            category: categorizeByFundName(h.fund),
            units: h.quantity,
            invested_value: investedValue,
            current_value: currentValue,
            pnl: currentValue - investedValue
        };
    });
}

/**
 * Attempt to categorize fund by name
 */
function categorizeByFundName(fundName) {
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

/**
 * Aggregate portfolio data from Kite
 */
async function aggregatePortfolio(kiteClient) {
    // Fetch all data in parallel
    const [holdings, positions, mfHoldings] = await Promise.all([
        kiteClient.getHoldings().catch(() => []),
        kiteClient.getPositions().catch(() => ({ net: [] })),
        kiteClient.getMfHoldings().catch(() => [])
    ]);

    // Normalize data
    const normalizedHoldings = normalizeHoldings(holdings);
    const normalizedPositions = normalizePositions(positions);
    const normalizedMfHoldings = normalizeMfHoldings(mfHoldings);

    // Calculate totals
    const equityValue = normalizedHoldings.reduce((sum, h) => sum + h.market_value, 0);
    const positionsExposure = normalizedPositions.reduce((sum, p) => sum + p.exposure, 0);
    const mfValue = normalizedMfHoldings.reduce((sum, h) => sum + h.current_value, 0);
    const totalValue = equityValue + mfValue;

    // Calculate P&L
    const equityPnL = normalizedHoldings.reduce((sum, h) => sum + h.pnl, 0);
    const positionsPnL = normalizedPositions.reduce((sum, p) => sum + p.pnl, 0);
    const mfPnL = normalizedMfHoldings.reduce((sum, h) => sum + h.pnl, 0);
    const totalPnL = equityPnL + mfPnL;

    // Calculate invested value for P&L %
    const equityInvested = normalizedHoldings.reduce((sum, h) => sum + (h.avg_price * h.quantity), 0);
    const mfInvested = normalizedMfHoldings.reduce((sum, h) => sum + h.invested_value, 0);
    const totalInvested = equityInvested + mfInvested;

    // Sector exposure (equity only)
    const sectorExposure = {};
    normalizedHoldings.forEach(h => {
        sectorExposure[h.sector] = (sectorExposure[h.sector] || 0) + h.market_value;
    });

    // MF category exposure
    const mfCategoryExposure = {};
    normalizedMfHoldings.forEach(h => {
        mfCategoryExposure[h.category] = (mfCategoryExposure[h.category] || 0) + h.current_value;
    });

    // Top holdings by value (combined equity + MF)
    const allHoldings = [
        ...normalizedHoldings.map(h => ({ name: h.symbol, value: h.market_value, type: 'equity' })),
        ...normalizedMfHoldings.map(h => ({ name: h.fund_name, value: h.current_value, type: 'mf' }))
    ].sort((a, b) => b.value - a.value);

    const top5Holdings = allHoldings.slice(0, 5);
    const top3Value = allHoldings.slice(0, 3).reduce((sum, h) => sum + h.value, 0);
    const topHoldingValue = allHoldings.length > 0 ? allHoldings[0].value : 0;

    return {
        portfolio_summary: {
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
            holdings_count: normalizedHoldings.length + normalizedMfHoldings.length
        },
        sector_exposure: sectorExposure,
        mf_category_exposure: mfCategoryExposure,
        top_5_holdings: top5Holdings,
        holdings: normalizedHoldings,
        positions: normalizedPositions,
        mutual_funds: normalizedMfHoldings
    };
}

/**
 * Build prompt for Gemini
 */
function buildGeminiPrompt(aggregatedData, depth = 'brief') {
    return {
        ...aggregatedData,
        analysis_request: {
            depth: depth,
            focus_areas: [
                'diversification',
                'risk',
                'allocation',
                'concentration',
                'improvements'
            ]
        }
    };
}

/**
 * Main analysis function
 */
async function analyzePortfolio(kiteClient, depth = 'brief') {
    const gemini = getGeminiClient();
    
    if (!gemini.isEnabled()) {
        throw new Error('AI analysis is not available. Gemini API key not configured.');
    }

    // Aggregate portfolio
    const aggregatedData = await aggregatePortfolio(kiteClient);

    // Check if user has any holdings
    if (aggregatedData.portfolio_summary.holdings_count === 0) {
        return {
            isEmpty: true,
            message: 'No holdings found. Add some investments to get AI-powered analysis.'
        };
    }

    // Build prompt
    const promptData = buildGeminiPrompt(aggregatedData, depth);

    // Get Gemini analysis
    const analysis = await gemini.analyzePortfolio(promptData);

    return {
        isEmpty: false,
        portfolioSummary: aggregatedData.portfolio_summary,
        analysis: analysis
    };
}

/**
 * Ask a custom question about the portfolio
 */
async function askPortfolioQuestion(kiteClient, question) {
    const gemini = getGeminiClient();
    
    if (!gemini.isEnabled()) {
        throw new Error('AI analysis is not available. Gemini API key not configured.');
    }

    // Aggregate portfolio
    const aggregatedData = await aggregatePortfolio(kiteClient);

    // Check if user has any holdings
    if (aggregatedData.portfolio_summary.holdings_count === 0) {
        return {
            isEmpty: true,
            message: 'No holdings found. Add some investments first.'
        };
    }

    // Get Gemini response
    const response = await gemini.askQuestion(aggregatedData, question);

    return {
        isEmpty: false,
        portfolioSummary: aggregatedData.portfolio_summary,
        answer: response
    };
}

module.exports = {
    aggregatePortfolio,
    analyzePortfolio,
    askPortfolioQuestion,
    normalizeHoldings,
    normalizePositions,
    normalizeMfHoldings
};
