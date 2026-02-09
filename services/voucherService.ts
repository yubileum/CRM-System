import { Voucher } from '../types';
import { getApiUrl } from './storage';

const VOUCHER_CACHE_KEY = 'dice_voucher_cache_v1';
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

interface CachedVouchers {
    vouchers: Voucher[];
    timestamp: number;
}

// Request deduplication
let fetchInProgress: Promise<Voucher[]> | null = null;

/**
 * Fetch vouchers from API
 */
const fetchVouchersFromAPI = async (userId: string): Promise<Voucher[]> => {
    const baseUrl = getApiUrl();
    if (!baseUrl) return [];

    try {
        const url = new URL(baseUrl);
        url.searchParams.append('action', 'getUserVouchers');
        url.searchParams.append('userId', userId);

        const response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors'
        });

        const data = await response.json();

        if (data.success && data.vouchers) {
            return data.vouchers;
        }

        return [];
    } catch (error) {
        console.error('Failed to fetch vouchers:', error);
        return [];
    }
};

/**
 * Get cached vouchers if still valid
 */
const getCachedVouchers = (userId: string): Voucher[] | null => {
    try {
        const cached = localStorage.getItem(`${VOUCHER_CACHE_KEY}_${userId}`);
        if (cached) {
            const { vouchers, timestamp }: CachedVouchers = JSON.parse(cached);
            const age = Date.now() - timestamp;

            if (age < CACHE_DURATION) {
                return vouchers;
            }
        }
    } catch (e) {
        console.error('Failed to read cached vouchers:', e);
    }
    return null;
};

/**
 * Cache vouchers
 */
const cacheVouchers = (userId: string, vouchers: Voucher[]): void => {
    try {
        const cached: CachedVouchers = {
            vouchers,
            timestamp: Date.now()
        };
        localStorage.setItem(`${VOUCHER_CACHE_KEY}_${userId}`, JSON.stringify(cached));
    } catch (e) {
        console.error('Failed to cache vouchers:', e);
    }
};

/**
 * Get user vouchers (with caching)
 */
export const getUserVouchers = async (userId: string, forceRefresh: boolean = false): Promise<Voucher[]> => {
    // Check cache first
    if (!forceRefresh) {
        const cached = getCachedVouchers(userId);
        if (cached) {
            // Refresh in background
            fetchVouchersFromAPI(userId).then(vouchers => {
                cacheVouchers(userId, vouchers);
            });
            return cached;
        }
    }

    // Prevent duplicate requests
    if (fetchInProgress) {
        return fetchInProgress;
    }

    fetchInProgress = fetchVouchersFromAPI(userId);
    const vouchers = await fetchInProgress;
    fetchInProgress = null;

    cacheVouchers(userId, vouchers);
    return vouchers;
};

/**
 * Redeem a voucher
 */
export const redeemVoucher = async (voucherId: string, userId: string): Promise<{ success: boolean; voucher?: Voucher; error?: string }> => {
    const baseUrl = getApiUrl();
    if (!baseUrl) return { success: false, error: 'API URL not configured' };

    try {
        const url = new URL(baseUrl);
        url.searchParams.append('action', 'redeemVoucher');

        const response = await fetch(url.toString(), {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify({ voucherId, userId })
        });

        const data = await response.json();

        if (data.success) {
            // Invalidate cache
            localStorage.removeItem(`${VOUCHER_CACHE_KEY}_${userId}`);
            return { success: true, voucher: data.voucher };
        }

        return { success: false, error: data.error || 'Failed to redeem voucher' };
    } catch (error) {
        console.error('Failed to redeem voucher:', error);
        return { success: false, error: 'Network error' };
    }
};

/**
 * Get active vouchers only
 */
export const getActiveVouchers = async (userId: string): Promise<Voucher[]> => {
    const vouchers = await getUserVouchers(userId);
    return vouchers.filter(v => v.status === 'active' && !isVoucherExpired(v));
};

/**
 * Check if voucher is expired
 */
export const isVoucherExpired = (voucher: Voucher): boolean => {
    const now = new Date();
    const expiresAt = new Date(voucher.expiresAt);
    return expiresAt < now;
};

/**
 * Get time remaining until expiry
 */
export const getTimeUntilExpiry = (voucher: Voucher): string => {
    const now = new Date();
    const expiresAt = new Date(voucher.expiresAt);
    const diff = expiresAt.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} left`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} left`;
    } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${minutes} minute${minutes > 1 ? 's' : ''} left`;
    }
};

/**
 * Clear voucher cache
 */
export const clearVoucherCache = (userId: string): void => {
    localStorage.removeItem(`${VOUCHER_CACHE_KEY}_${userId}`);
};
