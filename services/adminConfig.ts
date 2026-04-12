import { AdminEntry } from '../types';

const ADMIN_LIST_CACHE_KEY = 'loyalink_admin_list_cache_v1';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// API URL - same as storage.ts / stampConfig.ts
const API_URL = 'https://script.google.com/macros/s/AKfycbwJUABZ9PsGEv91FjlB33kOAsYsMm6oz77isOwtvw2JQQNSpvtwkBdby2EzyZgB7qcmVg/exec';

const DEFAULT_ADMINS: AdminEntry[] = [];

interface CachedAdmins {
    admins: AdminEntry[];
    timestamp: number;
}

let fetchInProgress: Promise<AdminEntry[]> | null = null;

/**
 * Fetch admin list from API
 */
const fetchAdminListFromAPI = async (): Promise<AdminEntry[]> => {
    if (fetchInProgress) {
        return fetchInProgress;
    }

    fetchInProgress = (async () => {
        try {
            const url = new URL(API_URL);
            url.searchParams.append('action', 'getAdminList');

            const response = await fetch(url.toString(), {
                method: 'GET',
                mode: 'cors'
            });

            const data = await response.json();

            if (data.success && Array.isArray(data.admins)) {
                return data.admins as AdminEntry[];
            }

            console.warn('[ADMIN_CONFIG] API returned unsuccessful response, using default');
            return DEFAULT_ADMINS;
        } catch (error) {
            console.error('[ADMIN_CONFIG] Failed to fetch admin list:', error);
            return DEFAULT_ADMINS;
        } finally {
            fetchInProgress = null;
        }
    })();

    return fetchInProgress;
};

/**
 * Get cached admin list if still valid
 */
const getCachedAdmins = (): { admins: AdminEntry[]; isStale: boolean } | null => {
    try {
        const cached = localStorage.getItem(ADMIN_LIST_CACHE_KEY);
        if (cached) {
            const { admins, timestamp }: CachedAdmins = JSON.parse(cached);
            const age = Date.now() - timestamp;
            return { admins, isStale: age >= CACHE_DURATION };
        }
    } catch (e) {
        console.error('[ADMIN_CONFIG] Failed to read cached admin list:', e);
    }
    return null;
};

/**
 * Cache admin list
 */
const cacheAdmins = (admins: AdminEntry[]): void => {
    try {
        const cached: CachedAdmins = { admins, timestamp: Date.now() };
        localStorage.setItem(ADMIN_LIST_CACHE_KEY, JSON.stringify(cached));
    } catch (e) {
        console.error('[ADMIN_CONFIG] Failed to cache admin list:', e);
    }
};

/**
 * Get admin list (sync, with background refresh)
 */
export const getAdminList = (): AdminEntry[] => {
    const cached = getCachedAdmins();
    if (cached) {
        if (cached.isStale) {
            fetchAdminListFromAPI().then(admins => cacheAdmins(admins));
        }
        return cached.admins;
    }
    // No cache — fetch in background
    fetchAdminListFromAPI().then(admins => cacheAdmins(admins));
    return DEFAULT_ADMINS;
};

/**
 * Fetch admin list (async, for initial load)
 */
export const fetchAdminList = async (): Promise<AdminEntry[]> => {
    const admins = await fetchAdminListFromAPI();
    cacheAdmins(admins);
    return admins;
};

/**
 * Save admin list to API
 */
export const saveAdminList = async (admins: AdminEntry[]): Promise<boolean> => {
    try {
        const url = new URL(API_URL);
        url.searchParams.append('action', 'saveAdminList');

        const response = await fetch(url.toString(), {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify({ admins })
        });

        const data = await response.json();

        if (data.success) {
            cacheAdmins(admins);
            return true;
        }

        return false;
    } catch (error) {
        console.error('[ADMIN_CONFIG] Failed to save admin list:', error);
        return false;
    }
};

/**
 * Clear admin list cache
 */
export const resetAdminListCache = (): void => {
    localStorage.removeItem(ADMIN_LIST_CACHE_KEY);
    console.log('[ADMIN_CONFIG] Admin list cache cleared');
};
