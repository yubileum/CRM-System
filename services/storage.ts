import { User, StampEvent } from '../types';

/**
 * GOOGLE SHEETS / LOCAL STORAGE HYBRID LAYER
 */

const SESSION_KEY = 'dice_current_session_v4';
const ADMIN_SESSION_KEY = 'dice_admin_authenticated_v4';
const ADMIN_LOGS_KEY = 'dice_admin_history_v4';
const SYNC_CHANNEL = new BroadcastChannel('dice_global_sync');

// --- STATIC CONFIGURATION ---
const STATIC_API_URL = 'https://script.google.com/macros/s/AKfycbwJUABZ9PsGEv91FjlB33kOAsYsMm6oz77isOwtvw2JQQNSpvtwkBdby2EzyZgB7qcmVg/exec';

export const setApiUrl = (url: string) => {
  console.warn("API URL is static and cannot be changed via client.");
};

export const getApiUrl = (): string | null => {
  return STATIC_API_URL;
};
// Request deduplication - prevent duplicate simultaneous requests
const pendingRequests = new Map<string, Promise<any>>();

const callApi = async (action: string, params: Record<string, string> = {}, payload?: any) => {
  const baseUrl = getApiUrl();
  if (!baseUrl) return null;

  // Create request key for deduplication (only for GET requests)
  const requestKey = !payload ? `${action}:${JSON.stringify(params)}` : null;

  // Check if this exact request is already in flight
  if (requestKey && pendingRequests.has(requestKey)) {
    console.log(`[DEDUPE] Reusing in-flight request for ${action}`);
    return pendingRequests.get(requestKey);
  }

  const url = new URL(baseUrl);
  url.searchParams.append('action', action);

  // Only add cache buster for write operations (POST) or actions that need fresh data
  const needsCacheBuster = payload || action === 'addStamp' || action === 'login' || action === 'register';
  if (needsCacheBuster) {
    url.searchParams.append('_t', Date.now().toString());
  }

  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

  const executeRequest = async () => {
    try {
      const options: RequestInit = {
        method: payload ? 'POST' : 'GET',
        mode: 'cors',
        // Do NOT set Content-Type header for GAS Web Apps to avoid preflight OPTIONS issues
      };

      if (payload) {
        options.body = JSON.stringify(payload);
      }

      const response = await fetch(url.toString(), options);
      const text = await response.text();

      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("API returned non-JSON:", text);
        return { success: false, fatal: true, error: 'Cannot connect to database. Check deployment permissions.' };
      }
    } catch (err) {
      console.error(`API Error (${action}):`, err);
      return { success: false, fatal: true, error: 'Network connection failed' };
    } finally {
      // Remove from pending requests when done
      if (requestKey) {
        pendingRequests.delete(requestKey);
      }
    }
  };

  const requestPromise = executeRequest();

  // Store in pending requests for deduplication
  if (requestKey) {
    pendingRequests.set(requestKey, requestPromise);
  }

  return requestPromise;
};

// --- AUTH SERVICES ---

export const setAdminSession = () => {
  localStorage.setItem(ADMIN_SESSION_KEY, 'true');
};

export const checkAdminSession = (): boolean => {
  return localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
};

export const getSessionUser = async (forceFetch: boolean = false): Promise<User | null> => {
  const sessionJson = localStorage.getItem(SESSION_KEY);
  if (!sessionJson) return null;

  const sessionData = JSON.parse(sessionJson);
  const { id } = sessionData;

  // Determine if we need a fresh fetch instead of relying solely on cache
  const needsFreshFetch = !sessionData.user ||
    !sessionData.user.history ||
    sessionData.version !== 'v1.1';

  // If we have cached user data and it's reasonably complete, return it immediately
  // while we optionally fetch the latest from the server in the background
  if (sessionData.user && !forceFetch && !needsFreshFetch) {
    // Refetch in background to update cache quietly
    callApi('getUser', { id }).then(res => {
      if (res?.success) {
        const oldStamps = sessionData.user.stamps;
        const newStamps = res.user.stamps;
        const hasChanges = oldStamps !== newStamps ||
          JSON.stringify(res.user.history) !== JSON.stringify(sessionData.user.history);

        if (hasChanges) {
          localStorage.setItem(SESSION_KEY, JSON.stringify({ ...sessionData, user: res.user, version: 'v1.1' }));
          SYNC_CHANNEL.postMessage({ type: 'DB_UPDATE' });
        }
      }
    });
    return sessionData.user;
  }

  const res = await callApi('getUser', { id });
  if (res?.success) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...sessionData, user: res.user, version: 'v1.1' }));
    return res.user;
  }
  return sessionData.user || null;
};

// Normalize phone number to handle various formats (for matching/login)
// Database stores as: 6287783856480 (no + sign)
// Examples: 
// - "0877 8323 5189" -> "6287783235189"
// - "+62 877-8323-5189" -> "6287783235189"
// - "62877 8323 5189" -> "6287783235189"
// - "6287783235189" -> "6287783235189"
const normalizePhone = (phone: string | number): string => {
  // Convert to string if it's a number
  const phoneStr = String(phone || '');

  // Remove all non-digit characters
  let normalized = phoneStr.replace(/\D/g, '');

  // Convert 0-prefix to 62
  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.substring(1);
  }

  // If it doesn't start with a country code and is long enough, prepend 62
  if (!normalized.startsWith('62') && !normalized.startsWith('1') && !normalized.startsWith('44') && normalized.length >= 8) {
    normalized = '62' + normalized;
  }

  return normalized;
};

// Standardize phone number to clean CountryCodeDigits format for storage (no + sign)
// Examples:
// - "0877 8323 5189" -> "6287783235189"
// - "62 877 8323 5189" -> "6287783235189"
// - "+62 877-8323-5189" -> "6287783235189"
// - "6287783235189" -> "6287783235189" (already clean)
const standardizePhone = (phone: string | number): string => {
  // Convert to string if it's a number
  const phoneStr = String(phone || '');

  // Remove all non-digit characters (including +)
  let cleaned = phoneStr.replace(/\D/g, '');

  // If starts with 0, convert to 62
  if (cleaned.startsWith('0')) {
    return '62' + cleaned.substring(1);
  }

  // If already starts with country code, return as is
  if (cleaned.length >= 10) {
    return cleaned;
  }

  // If it's a short local number, prepend 62
  if (cleaned.length >= 8) {
    return '62' + cleaned;
  }

  return cleaned;
};

export const loginUser = async (phone: string, birthDate: string): Promise<User> => {
  // Admin check - if phone field contains 'admin', treat as admin login
  if (phone.toLowerCase().includes('admin')) {
    throw new Error("Admin login is handled client-side.");
  }

  // Normalize phone number
  const normalizedPhone = normalizePhone(phone);

  // Debug: Log what we're sending
  console.log('=== LOGIN DEBUG ===');
  console.log('Phone (raw):', phone);
  console.log('Phone (normalized):', normalizedPhone);
  console.log('BirthDate (raw):', birthDate);

  // Send phone as 'username' and birthDate as 'password' to match backend expectations
  // The backend will look up the user by phone number in the spreadsheet
  const res = await callApi('login', {}, {
    username: normalizedPhone.trim(),  // Backend expects 'username' field
    password: birthDate.trim()  // Backend expects 'password' field
  });

  console.log('API Response:', res);

  if (res?.success) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      phone: res.user.phone,
      id: res.user.id,
      user: res.user,
      version: 'v1.1'
    }));
    return res.user;
  } else {
    throw new Error(res?.error || 'Login failed. Please check your phone number and birth date.');
  }
};

export const logoutUser = () => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ADMIN_SESSION_KEY);
};

export const registerUser = async (details: {
  name: string;
  email: string;
  phone: string;
  address: string;
  birthDate: string;
}): Promise<User> => {
  // Standardize phone number to +62 format before registration
  const standardizedPhone = standardizePhone(details.phone);
  const payload = { ...details, phone: standardizedPhone, id: `user-${Date.now()}` };
  const res = await callApi('register', {}, payload);

  if (res?.success) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      phone: res.user.phone,
      id: res.user.id,
      user: res.user,
      version: 'v1.1'
    }));
    return res.user;
  } else {
    throw new Error(res?.error || 'Registration failed');
  }
};


export const getUserHistory = async (userId: string): Promise<StampEvent[]> => {
  const res = await callApi('getHistory', { userId });
  return res?.success ? res.history : [];
};

// --- STAMP OPERATIONS ---

export const applyStampToUser = async (userId: string, count: number = 1): Promise<User | null> => {
  let lastUser: User | null = null;

  // Loop to add multiple stamps since backend currently supports 1 at a time
  for (let i = 0; i < count; i++) {
    const res = await callApi('addStamp', {}, { userId });
    if (res?.success) {
      lastUser = res.user;
      SYNC_CHANNEL.postMessage({ type: 'DB_UPDATE' });

      // Check if voucher was earned
      if (res.voucher) {
        SYNC_CHANNEL.postMessage({
          type: 'VOUCHER_EARNED',
          voucher: res.voucher
        });
      }
    } else {
      // If one fails (e.g. max stamps reached), stop and return what we have so far
      break;
    }
  }

  return lastUser;
};

export const fetchUserById = async (userId: string): Promise<User | null> => {
  const res = await callApi('getUser', { id: userId });
  return res?.success ? res.user : null;
};

export const fetchUserByPhone = async (phone: string): Promise<User | null> => {
  const normalizedPhone = normalizePhone(phone);

  // Fetch all users and search for matching phone number
  const res = await callApi('getAll');

  if (res?.users && Array.isArray(res.users)) {
    // Search for user with matching phone number
    const user = res.users.find((u: User) => {
      const userPhone = normalizePhone(u.phone || '');
      return userPhone === normalizedPhone;
    });

    return user || null;
  }

  return null;
};

// --- ADMIN SERVICES ---

export const getAllUsersList = async (): Promise<User[]> => {
  const res = await callApi('getAll');
  return res?.users || [];
};

export const logAdminTransaction = (userId: string, userName: string, type: 'add' | 'redeem', amount: number = 1) => {
  const logs = JSON.parse(localStorage.getItem(ADMIN_LOGS_KEY) || '[]');
  logs.push({
    id: `tx-${Date.now()}`,
    timestamp: Date.now(),
    userId,
    userName,
    type,
    amount
  });
  localStorage.setItem(ADMIN_LOGS_KEY, JSON.stringify(logs));
};

export const generateTransactionCSV = (): string => {
  const logs = JSON.parse(localStorage.getItem(ADMIN_LOGS_KEY) || '[]');
  if (logs.length === 0) return 'No transactions recorded.';

  const headers = ['Date', 'Time', 'Member Name', 'Member ID', 'Action', 'Amount'];
  const rows = logs.map((l: any) => {
    const d = new Date(l.timestamp);
    return [
      d.toLocaleDateString(),
      d.toLocaleTimeString(),
      l.userName,
      l.userId,
      l.type.toUpperCase(),
      l.amount || 1
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};

export const generateMembersCSV = async (): Promise<string> => {
  const users = await getAllUsersList();
  if (users.length === 0) return 'No members registered.';

  const headers = ['Name', 'Username', 'Email', 'Phone', 'Address', 'Birth Date', 'Current Stamps', 'Member ID'];
  const rows = users.map((u: User) => [
    u.name,
    u.username,
    u.email,
    u.phone,
    `"${u.address || ''}"`,
    u.birthDate || '',
    u.stamps,
    u.id
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
};

// --- SUBSCRIPTIONS ---

export const subscribeToGlobalUpdates = (callback: () => void) => {
  const handler = (msg: any) => {
    if (msg.data?.type === 'DB_UPDATE') callback();
  };
  SYNC_CHANNEL.addEventListener('message', handler);
  return () => {
    SYNC_CHANNEL.removeEventListener('message', handler);
  };
};