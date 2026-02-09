import { StampConfig, StampCheckpoint } from '../types';

const STAMP_CONFIG_CACHE_KEY = 'dice_stamp_config_cache_v1';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (increased from 5)

// API URL - same as storage.ts
const API_URL = 'https://script.google.com/macros/s/AKfycbwJUABZ9PsGEv91FjlB33kOAsYsMm6oz77isOwtvw2JQQNSpvtwkBdby2EzyZgB7qcmVg/exec';

// Default configuration (fallback)
const DEFAULT_CONFIG: StampConfig = {
    maxStamps: 10,
    checkpoints: [
        { stampCount: 3, reward: 'Free Lychee Tea' },
        { stampCount: 5, reward: 'diskon 15% off game' },
        { stampCount: 7, reward: 'Free french fries' },
        { stampCount: 10, reward: 'Free all day pass' }
    ]
};

interface CachedConfig {
    config: StampConfig;
    timestamp: number;
}

// Track if a fetch is in progress to prevent duplicate requests
let fetchInProgress: Promise<StampConfig> | null = null;

/**
 * Fetch stamp configuration from API
 */
const fetchConfigFromAPI = async (): Promise<StampConfig> => {
    // If fetch is already in progress, return that promise
    if (fetchInProgress) {
        console.log('[STAMP_CONFIG] Reusing in-flight config fetch');
        return fetchInProgress;
    }

    fetchInProgress = (async () => {
        try {
            const url = new URL(API_URL);
            url.searchParams.append('action', 'getCheckpointConfig');
            // No cache buster needed - this is a read operation that benefits from caching

            const response = await fetch(url.toString(), {
                method: 'GET',
                mode: 'cors'
            });

            const data = await response.json();

            if (data.success && data.config) {
                return data.config;
            }

            console.warn('API returned unsuccessful response, using default config');
            return DEFAULT_CONFIG;
        } catch (error) {
            console.error('Failed to fetch stamp config from API:', error);
            return DEFAULT_CONFIG;
        } finally {
            fetchInProgress = null;
        }
    })();

    return fetchInProgress;
};

/**
 * Get cached configuration if still valid
 */
const getCachedConfig = (): { config: StampConfig; isStale: boolean } | null => {
    try {
        const cached = localStorage.getItem(STAMP_CONFIG_CACHE_KEY);
        if (cached) {
            const { config, timestamp }: CachedConfig = JSON.parse(cached);
            const age = Date.now() - timestamp;

            return {
                config,
                isStale: age >= CACHE_DURATION
            };
        }
    } catch (e) {
        console.error('Failed to read cached config:', e);
    }
    return null;
};

/**
 * Cache configuration
 */
const cacheConfig = (config: StampConfig): void => {
    try {
        const cached: CachedConfig = {
            config,
            timestamp: Date.now()
        };
        localStorage.setItem(STAMP_CONFIG_CACHE_KEY, JSON.stringify(cached));
    } catch (e) {
        console.error('Failed to cache config:', e);
    }
};

/**
 * Get stamp configuration (with caching)
 */
export const getStampConfig = (): StampConfig => {
    // Try cache first
    const cached = getCachedConfig();
    if (cached) {
        // If cache is stale, refresh in background
        if (cached.isStale) {
            console.log('[STAMP_CONFIG] Cache stale, refreshing in background');
            fetchConfigFromAPI().then(config => {
                cacheConfig(config);
            });
        }
        return cached.config;
    }

    // No cache - return default and fetch in background
    fetchConfigFromAPI().then(config => {
        cacheConfig(config);
    });

    return DEFAULT_CONFIG;
};

/**
 * Get stamp configuration (async version for initial load)
 */
export const fetchStampConfig = async (): Promise<StampConfig> => {
    const config = await fetchConfigFromAPI();
    cacheConfig(config);
    return config;
};

/**
 * Save stamp configuration to API
 */
export const saveStampConfig = async (config: StampConfig): Promise<boolean> => {
    try {
        const url = new URL(API_URL);
        url.searchParams.append('action', 'saveCheckpointConfig');

        const response = await fetch(url.toString(), {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(config)
        });

        const data = await response.json();

        if (data.success) {
            // Update cache
            cacheConfig(config);
            // Clear old localStorage key if it exists
            localStorage.removeItem('dice_stamp_config_v1');
            return true;
        }

        return false;
    } catch (error) {
        console.error('Failed to save stamp config:', error);
        return false;
    }
};

export const isCheckpoint = (stampCount: number): boolean => {
    const config = getStampConfig();
    return config.checkpoints.some(cp => cp.stampCount === stampCount);
};

export const getCheckpointReward = (stampCount: number): string | null => {
    const config = getStampConfig();
    const checkpoint = config.checkpoints.find(cp => cp.stampCount === stampCount);
    return checkpoint ? checkpoint.reward : null;
};

export const resetStampConfig = (): void => {
    localStorage.removeItem(STAMP_CONFIG_CACHE_KEY);
    localStorage.removeItem('dice_stamp_config_v1');
    console.log('Stamp configuration cache cleared');
};
