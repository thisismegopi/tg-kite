/**
 * MF Instruments Cache
 * 
 * Caches the mutual fund instruments list to avoid frequent API calls.
 * The /mf/instruments endpoint returns a large CSV (~2000+ funds).
 * 
 * Features:
 * - In-memory cache with 24-hour TTL
 * - Lazy loading on first request
 * - Search by fund name, AMC, or scheme code
 */

// Cache storage
let instrumentsCache = null;
let lastFetchedAt = null;

// Cache TTL: 24 hours in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Check if the cache is expired or empty
 */
function isCacheExpired() {
    if (!instrumentsCache || !lastFetchedAt) {
        return true;
    }
    return (Date.now() - lastFetchedAt) > CACHE_TTL_MS;
}

/**
 * Parse CSV string into array of objects
 * @param {string} csvText - Raw CSV text from API
 * @returns {Array} Array of instrument objects
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const instruments = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length !== headers.length) continue;

        const instrument = {};
        headers.forEach((header, idx) => {
            let value = values[idx];
            // Convert numeric strings to numbers
            if (['minimum_purchase_amount', 'purchase_amount_multiplier', 
                 'minimum_additional_purchase_amount', 'minimum_redemption_quantity',
                 'redemption_quantity_multiplier', 'last_price'].includes(header)) {
                value = parseFloat(value) || 0;
            } else if (['purchase_allowed', 'redemption_allowed'].includes(header)) {
                value = value === '1';
            }
            instrument[header] = value;
        });
        instruments.push(instrument);
    }

    return instruments;
}

/**
 * Load instruments from API and cache them
 * @param {KiteClient} kiteClient - Initialized Kite client instance
 */
async function loadInstruments(kiteClient) {
    try {
        const csvData = await kiteClient.getMfInstruments();
        instrumentsCache = parseCSV(csvData);
        lastFetchedAt = Date.now();
        console.log(`MF Instruments cache loaded: ${instrumentsCache.length} funds`);
        return instrumentsCache;
    } catch (error) {
        console.error('Failed to load MF instruments:', error.message);
        throw error;
    }
}

/**
 * Get instruments, loading from API if cache is expired
 * @param {KiteClient} kiteClient - Initialized Kite client instance
 */
async function getInstruments(kiteClient) {
    if (isCacheExpired()) {
        await loadInstruments(kiteClient);
    }
    return instrumentsCache;
}

/**
 * Search instruments by name, AMC, or trading symbol
 * @param {KiteClient} kiteClient - Initialized Kite client instance
 * @param {string} query - Search query
 * @param {number} limit - Max results to return (default 10)
 * @returns {Array} Matching instruments
 */
async function searchInstruments(kiteClient, query, limit = 10) {
    const instruments = await getInstruments(kiteClient);
    
    if (!query || query.trim() === '') {
        return [];
    }

    const searchTerm = query.toLowerCase().trim();
    
    const matches = instruments.filter(inst => {
        const name = (inst.name || '').toLowerCase();
        const amc = (inst.amc || '').toLowerCase();
        const symbol = (inst.tradingsymbol || '').toLowerCase();
        
        return name.includes(searchTerm) || 
               amc.includes(searchTerm) || 
               symbol.includes(searchTerm);
    });

    return matches.slice(0, limit);
}

/**
 * Clear the cache (useful for testing or forced refresh)
 */
function clearCache() {
    instrumentsCache = null;
    lastFetchedAt = null;
}

/**
 * Get cache stats
 */
function getCacheStats() {
    return {
        isCached: !!instrumentsCache,
        instrumentCount: instrumentsCache ? instrumentsCache.length : 0,
        lastFetchedAt: lastFetchedAt,
        isExpired: isCacheExpired(),
        ttlMs: CACHE_TTL_MS
    };
}

module.exports = {
    getInstruments,
    searchInstruments,
    clearCache,
    getCacheStats,
    isCacheExpired
};
