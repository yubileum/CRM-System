import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'react-qr-code';
import { User, StampConfig, StampEvent, Voucher } from '../types';
import { getSessionUser, subscribeToGlobalUpdates, getUserHistory } from '../services/storage';
import { initializeHost } from '../services/connection';
import { StampGrid } from './StampGrid';
import { CheckpointRewardPopup } from './CheckpointRewardPopup';
import { MyVouchers } from './MyVouchers';
import { VoucherRedemptionPopup } from './VoucherRedemptionPopup';
import { Sparkles, History, LogOut, Wifi, WifiOff, Scan, Gift, TrendingUp, Award, Zap, X, Ticket } from 'lucide-react';
import { getRewardInsight } from '../services/geminiService';
import { getBrandConfig } from '../services/branding';
import { getStampConfig, fetchStampConfig } from '../services/stampConfig';
import { getActiveVouchers, redeemVoucher as redeemVoucherAPI, clearVoucherCache } from '../services/voucherService';

interface MemberViewProps {
  currentUser: User;
  onLogout: () => void;
}

export const MemberView: React.FC<MemberViewProps> = ({ currentUser, onLogout }) => {
  const [user, setUser] = useState<User>(currentUser);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [peerId, setPeerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [scanNotification, setScanNotification] = useState<boolean>(false);
  const [showQR, setShowQR] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyEvents, setHistoryEvents] = useState<StampEvent[]>(user.history || []);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const peerRef = useRef<any>(null);
  const brandConfig = getBrandConfig();
  const [stampConfig, setStampConfig] = useState<StampConfig>(getStampConfig());

  // Voucher states
  const [newVoucher, setNewVoucher] = useState<Voucher | null>(null);
  const [showMyVouchers, setShowMyVouchers] = useState<boolean>(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [activeVoucherCount, setActiveVoucherCount] = useState<number>(0);

  // No need to fetch on mount - getStampConfig() handles caching and background refresh
  // Config will update automatically when cache refreshes

  // Calculate next checkpoint
  const nextCheckpoint = stampConfig.checkpoints
    .filter(cp => cp.stampCount > user.stamps)
    .sort((a, b) => a.stampCount - b.stampCount)[0];

  const latestUserRef = useRef<User>(user);
  useEffect(() => { latestUserRef.current = user; }, [user]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Load active voucher count
  useEffect(() => {
    const loadVoucherCount = async () => {
      try {
        const activeVouchers = await getActiveVouchers(user.id);
        setActiveVoucherCount(activeVouchers.length);
      } catch (error) {
        console.error('Failed to load voucher count:', error);
      }
    };
    loadVoucherCount();
  }, [user.id]);

  useEffect(() => {
    const fetchLatest = async (isManual = false) => {
      try {
        const updated = await getSessionUser(isManual);
        if (updated) {
          if (JSON.stringify(updated) !== JSON.stringify(latestUserRef.current)) {
            setUser(updated);
          }
        }
      } catch (error) {
        console.error('Failed to fetch latest user:', error);
      }
    };

    // Initial silent sync
    fetchLatest();

    // Polling every 5 seconds instead of 10
    const interval = setInterval(() => fetchLatest(false), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToGlobalUpdates(async () => {
      const updated = await getSessionUser();
      if (updated) setUser(updated);
    });

    // Listen for voucher earned events
    const voucherChannel = new BroadcastChannel('dice_global_sync');
    const handleVoucherEvent = (event: MessageEvent) => {
      if (event.data?.type === 'VOUCHER_EARNED' && event.data?.voucher) {
        handleVoucherEarned(event.data.voucher);
      }
    };
    voucherChannel.addEventListener('message', handleVoucherEvent);

    const initP2P = async () => {
      const { peer, peerId: id } = await initializeHost(
        user,
        async (cmd, payload) => {
          if (cmd === 'ADD_STAMP') {
            const count = payload?.count || 1;

            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Stamp Added!", {
                body: `You received ${count} new stamp${count > 1 ? 's' : ''}!`,
                icon: '/favicon.ico'
              });
            }
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

            setUser(prev => {
              const newStamps = Math.min(prev.stamps + count, prev.maxStamps);
              const newHistory = [...prev.history, {
                id: `temp-${Date.now()}`,
                timestamp: Date.now(),
                type: 'add' as const,
                amount: count
              }];
              return { ...prev, stamps: newStamps, history: newHistory };
            });

            setTimeout(async () => {
              const updated = await getSessionUser(true); // Force fetch after P2P stamp
              if (updated) setUser(updated);
            }, 1000); // Wait a bit for backend to process;

            return true;
          }

          if (cmd === 'SCAN_ALERT') {
            setScanNotification(true);
            setTimeout(() => setScanNotification(false), 3000);

            if (navigator.vibrate) navigator.vibrate(100);
            return true;
          }

          return false;
        },
        () => latestUserRef.current
      );

      peerRef.current = peer;
      if (id) {
        setPeerId(id);
        setIsConnected(true);
      }
    };

    initP2P();
    return () => {
      unsubscribe();
      voucherChannel.removeEventListener('message', handleVoucherEvent);
      voucherChannel.close();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const handleOpenHistory = async () => {
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const history = await getUserHistory(user.id);
      setHistoryEvents(history);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAskAi = async () => {
    setLoadingAi(true);
    const text = await getRewardInsight(user);
    setAiInsight(text);
    setLoadingAi(false);
  };

  // Voucher handlers
  const handleVoucherEarned = (voucher: Voucher) => {
    setNewVoucher(voucher);
    // Refresh voucher count
    getActiveVouchers(user.id).then(vouchers => {
      setActiveVoucherCount(vouchers.length);
    });
  };

  const handleUseVoucher = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setShowMyVouchers(false);
  };

  const handleRedeemVoucher = async () => {
    if (!selectedVoucher) return;

    try {
      const result = await redeemVoucherAPI(selectedVoucher.id, user.id);
      if (result.success) {
        // Clear cache and refresh count
        clearVoucherCache(user.id);
        const activeVouchers = await getActiveVouchers(user.id);
        setActiveVoucherCount(activeVouchers.length);
      } else {
        alert(result.error || 'Failed to redeem voucher');
      }
    } catch (error) {
      console.error('Redemption error:', error);
      alert('Failed to redeem voucher');
    }
  };

  const qrPayload = {
    id: user.id,
    pid: peerId || '',
    n: user.name,
    s: user.stamps,
    m: user.maxStamps
  };
  const qrData = JSON.stringify(qrPayload);

  const progress = (user.stamps / user.maxStamps) * 100;
  const stampsRemaining = user.maxStamps - user.stamps;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-brand-500/5 to-brand-600/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-brand-400/5 to-brand-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      {/* Header */}
      <header className="relative z-10 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {brandConfig.logoUrl ? (
              <img src={brandConfig.logoUrl} alt={brandConfig.name} className="h-10 object-contain" />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-brand-600 to-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30">
                <span className="text-white font-black text-lg">{brandConfig.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <h1 className="font-black text-lg sm:text-xl tracking-tight text-gray-900">{brandConfig.name}</h1>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{brandConfig.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMyVouchers(true)}
              className="relative px-4 py-2 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-md hover:shadow-lg transform hover:scale-105"
              title="My Vouchers"
            >
              <Ticket size={18} />
              <span>My Vouchers</span>
              {activeVoucherCount > 0 && (
                <span className="bg-white text-brand-600 text-xs font-bold rounded-full px-2 py-0.5 ml-1">
                  {activeVoucherCount}
                </span>
              )}
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 text-sm font-bold transition-all"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-2xl w-full mx-auto p-6 flex flex-col gap-6 pb-12">

        {/* Scan Notification */}
        {scanNotification && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-brand-600 to-brand-500 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-brand-500/50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <Scan size={20} className="animate-pulse" />
            <span className="font-bold">Admin is scanning your code...</span>
          </div>
        )}

        {/* Hero Card - User Info & Progress */}
        <div className="bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 rounded-3xl shadow-2xl shadow-brand-500/30 overflow-hidden relative">
          {/* Animated background pattern */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMTZjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTR6bTAgMjRjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTR6TTEyIDE2YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDQtMS43OSA0LTQgNC00LTEuNzktNC00em0wIDI0YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDQtMS43OSA0LTQgNC00LTEuNzktNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>

          <div className="relative p-6 sm:p-8">
            {/* Connection Status Badge */}
            <div className="absolute top-6 right-6">
              {isConnected ? (
                <div className="flex items-center gap-2 text-xs font-bold text-white bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/30 shadow-lg">
                  <Wifi size={14} className="animate-pulse" /> Live
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-bold text-white/80 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                  <WifiOff size={14} /> Syncing
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white font-black text-3xl border-2 border-white/30 shadow-xl">
                {user.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">{user.name}</h2>
                <p className="text-white/80 font-bold text-sm">Member since {new Date(user.createdAt || Date.now()).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Progress Section */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/80 text-sm font-bold mb-1">Your Progress</p>
                  <p className="text-3xl sm:text-4xl font-black text-white">{user.stamps}<span className="text-xl sm:text-2xl text-white/60">/{user.maxStamps}</span></p>
                </div>
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center border-2 border-white/30">
                  <Award size={40} className="text-white drop-shadow-lg" />
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-4 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-white to-white/90 rounded-full transition-all duration-1000 ease-out shadow-lg"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/40 to-white/0 animate-shimmer"></div>
                </div>
              </div>

              {stampsRemaining > 0 ? (
                <p className="text-white text-base sm:text-lg font-black mt-2 sm:mt-3 leading-tight">
                  <TrendingUp size={16} />
                  {nextCheckpoint
                    ? `${nextCheckpoint.stampCount - user.stamps} more stamp${nextCheckpoint.stampCount - user.stamps !== 1 ? 's' : ''} to get ${nextCheckpoint.reward}!`
                    : `${stampsRemaining} more stamp${stampsRemaining !== 1 ? 's' : ''} to your reward!`
                  }
                </p>
              ) : (
                <p className="text-white text-sm font-bold mt-3 flex items-center gap-2">
                  <Gift size={16} className="animate-bounce" />
                  Reward ready! Show this to redeem.
                </p>
              )}
            </div>

            {/* QR Code Toggle Button */}
            <button
              onClick={() => setShowQR(!showQR)}
              className="w-full mt-4 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-black py-4 rounded-xl border-2 border-white/30 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <Scan size={20} />
              {showQR ? 'Hide QR Code' : 'Show QR Code to Scan'}
            </button>
          </div>
        </div>

        {/* QR Code Modal */}
        {showQR && (
          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-200 animate-in zoom-in-95 fade-in">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-black text-gray-900 mb-2">Scan to Collect Stamps</h3>
              <p className="text-gray-600 font-medium">Show this QR code to the cashier</p>
            </div>
            <div className="flex justify-center p-6 bg-gray-50 rounded-2xl border-2 border-gray-200">
              <QRCode value={qrData} size={240} level="L" fgColor="#000000" bgColor="#FFFFFF" />
            </div>
            <button
              onClick={() => setShowQR(false)}
              className="w-full mt-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-all"
            >
              Close
            </button>
          </div>
        )}

        {/* Stamps Grid */}
        <StampGrid user={user} />

        {/* Activity History Button (Static Card Style) */}
        <div className="mt-2 text-center">
          <button
            onClick={handleOpenHistory}
            className="w-full bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-lg hover:shadow-xl hover:border-brand-200 transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-brand-50 transition-colors">
                <History size={20} sm:size={24} className="text-gray-400 group-hover:text-brand-600 transition-colors" />
              </div>
              <div className="text-left">
                <p className="font-black text-gray-900 text-sm sm:text-base">Recent Activity</p>
                <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest leading-none mt-1">View your stamp history</p>
              </div>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-brand-50 transition-colors">
              <Zap size={16} sm:size={18} className="text-gray-300 group-hover:text-brand-500" />
            </div>
          </button>
        </div>

        {/* History Modal */}
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center">
                    <History size={24} className="text-brand-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Recent Activity</h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Your stamp journey</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-3 bg-white text-gray-400 hover:text-gray-600 rounded-2xl border border-gray-100 shadow-sm transition-all active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                <div className="space-y-3">
                  {loadingHistory ? (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto"></div>
                      <p className="text-gray-500 font-bold animate-pulse">Fetching your history...</p>
                    </div>
                  ) : historyEvents.length > 0 ? (
                    historyEvents.slice().reverse().map(evt => {
                      // Determine event display properties
                      const getEventDisplay = () => {
                        switch (evt.type) {
                          case 'add':
                            return {
                              icon: <TrendingUp size={20} className="text-green-600" />,
                              bgColor: 'bg-green-100',
                              label: 'Stamp Collected',
                              badge: `+${evt.amount || 1}`,
                              badgeColor: 'bg-green-500 text-white'
                            };
                          case 'voucher_earned':
                            return {
                              icon: <Gift size={20} className="text-blue-600" />,
                              bgColor: 'bg-blue-100',
                              label: 'Voucher Earned',
                              badge: '🎁',
                              badgeColor: 'bg-blue-500 text-white'
                            };
                          case 'voucher_redeemed':
                            return {
                              icon: <Gift size={20} className="text-orange-600" />,
                              bgColor: 'bg-orange-100',
                              label: 'Voucher Redeemed',
                              badge: 'USED',
                              badgeColor: 'bg-orange-500 text-white'
                            };
                          case 'redeem':
                          default:
                            return {
                              icon: <Award size={20} className="text-purple-600" />,
                              bgColor: 'bg-purple-100',
                              label: 'Reward Redeemed',
                              badge: 'USED',
                              badgeColor: 'bg-purple-500 text-white'
                            };
                        }
                      };

                      const display = getEventDisplay();

                      return (
                        <div key={evt.id} className="p-4 rounded-3xl bg-gray-50/50 border border-gray-100 flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${display.bgColor}`}>
                              {display.icon}
                            </div>
                            <div>
                              <p className="font-black text-gray-900 text-sm">
                                {display.label}
                              </p>
                              <p className="text-[10px] text-gray-500 font-bold">
                                {new Date(evt.timestamp).toLocaleString(undefined, {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <span className={`text-sm font-black px-4 py-2 rounded-xl shadow-sm ${display.badgeColor}`}>
                            {display.badge}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto border border-gray-100">
                        <History size={32} className="text-gray-300" />
                      </div>
                      <div>
                        <p className="text-gray-900 font-black text-lg">No activity yet</p>
                        <p className="text-gray-400 text-sm font-medium">Start collecting stamps to see your history!</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-gray-50/50 border-t border-gray-100">
                <button
                  onClick={() => setShowHistory(false)}
                  className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black transition-all active:scale-[0.98]"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Voucher Popups */}
      {newVoucher && (
        <CheckpointRewardPopup
          voucher={newVoucher}
          onUseNow={() => {
            setSelectedVoucher(newVoucher);
            setNewVoucher(null);
          }}
          onSaveLater={() => setNewVoucher(null)}
        />
      )}

      {showMyVouchers && (
        <MyVouchers
          userId={user.id}
          onUseVoucher={handleUseVoucher}
          onClose={() => setShowMyVouchers(false)}
        />
      )}

      {selectedVoucher && (
        <VoucherRedemptionPopup
          voucher={selectedVoucher}
          onRedeem={handleRedeemVoucher}
          onClose={() => setSelectedVoucher(null)}
        />
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </div>
  );
};
