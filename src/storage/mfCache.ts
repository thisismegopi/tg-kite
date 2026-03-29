import type KiteClient from '../kite/client';
import type { MfInstrumentRecord } from '../types/kite';

let instrumentsCache: MfInstrumentRecord[] | null = null;
let lastFetchedAt: number | null = null;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isCacheExpired() {
    if (!instrumentsCache || !lastFetchedAt) {
        return true;
    }

    return Date.now() - lastFetchedAt > CACHE_TTL_MS;
}

function parseCSV(csvText: string): MfInstrumentRecord[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const instruments: MfInstrumentRecord[] = [];

    for (let i = 1; i < lines.length; i += 1) {
        const values = lines[i].split(',');
        if (values.length !== headers.length) continue;

        const instrument: Record<string, string | number | boolean | undefined> = {};
        headers.forEach((header, index) => {
            let value: string | number | boolean = values[index];

            if (
                ['minimum_purchase_amount', 'purchase_amount_multiplier', 'minimum_additional_purchase_amount', 'minimum_redemption_quantity', 'redemption_quantity_multiplier', 'last_price'].includes(
                    header,
                )
            ) {
                value = parseFloat(values[index]) || 0;
            } else if (['purchase_allowed', 'redemption_allowed'].includes(header)) {
                value = values[index] === '1';
            }

            instrument[header] = value;
        });

        instruments.push(instrument as MfInstrumentRecord);
    }

    return instruments;
}

async function loadInstruments(kiteClient: KiteClient) {
    try {
        const csvData = await kiteClient.getMfInstruments();
        instrumentsCache = parseCSV(csvData);
        lastFetchedAt = Date.now();
        console.log(`MF Instruments cache loaded: ${instrumentsCache.length} funds`);
        return instrumentsCache;
    } catch (error: any) {
        console.error('Failed to load MF instruments:', error.message);
        throw error;
    }
}

async function getInstruments(kiteClient: KiteClient) {
    if (isCacheExpired()) {
        await loadInstruments(kiteClient);
    }

    return instrumentsCache || [];
}

async function searchInstruments(kiteClient: KiteClient, query: string, limit = 10) {
    const instruments = await getInstruments(kiteClient);

    if (!query || query.trim() === '') {
        return [] as MfInstrumentRecord[];
    }

    const searchTerm = query.toLowerCase().trim();
    const matches = instruments.filter(inst => {
        const name = (inst.name || '').toLowerCase();
        const amc = (inst.amc || '').toLowerCase();
        const symbol = (inst.tradingsymbol || '').toLowerCase();

        return name.includes(searchTerm) || amc.includes(searchTerm) || symbol.includes(searchTerm);
    });

    return matches.slice(0, limit);
}

function clearCache() {
    instrumentsCache = null;
    lastFetchedAt = null;
}

function getCacheStats() {
    return {
        isCached: !!instrumentsCache,
        instrumentCount: instrumentsCache ? instrumentsCache.length : 0,
        lastFetchedAt,
        isExpired: isCacheExpired(),
        ttlMs: CACHE_TTL_MS,
    };
}

export = {
    getInstruments,
    searchInstruments,
    clearCache,
    getCacheStats,
    isCacheExpired,
};
