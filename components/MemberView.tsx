
import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'react-qr-code';
import { User } from '../types';
import { getSessionUser, subscribeToGlobalUpdates } from '../services/storage';
import { initializeHost } from '../services/connection';
import { StampGrid } from './StampGrid';
import { Sparkles, History, LogOut, RefreshCw, Coffee, Wifi, WifiOff, Scan } from 'lucide-react';
import { getRewardInsight } from '../services/geminiService';

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
  const peerRef = useRef<any>(null);
  
  const latestUserRef = useRef<User>(user);
  useEffect(() => { latestUserRef.current = user; }, [user]);

  // Request Notification Permissions on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Polling to keep data fresh if P2P fails
  useEffect(() => {
    const fetchLatest = async () => {
        const updated = await getSessionUser();
        if (updated) {
            // Only update if stamps changed to avoid jitter
            if (updated.stamps !== latestUserRef.current.stamps) {
                setUser(updated);
            }
        }
    };
    
    // Poll every 10 seconds
    const interval = setInterval(fetchLatest, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // 1. Subscribe to "Central DB" changes (Local Event Bus)
    const unsubscribe = subscribeToGlobalUpdates(async () => {
      const updated = await getSessionUser();
      if (updated) setUser(updated);
    });

    // 2. Start P2P Database Host
    const initP2P = async () => {
      const { peer, peerId: id } = await initializeHost(
        user, 
        async (cmd, payload) => {
          if (cmd === 'ADD_STAMP') {
            const count = payload?.count || 1;
            
            // Notification: System Push + Vibrate
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Stamp Added!", { 
                    body: `You received ${count} new stamp${count > 1 ? 's' : ''}!`,
                    icon: '/favicon.ico'
                });
            }
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

            // OPTIMISTIC UPDATE: Update UI immediately without waiting for API
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

            // BACKGROUND SYNC: Fetch true state from server to ensure consistency
            // Small delay allows DB write from Admin to propagate
            setTimeout(async () => {
                const updated = await getSessionUser();
                if (updated) setUser(updated);
            }, 1000);

            return true;
          }

          if (cmd === 'SCAN_ALERT') {
             // Show internal toast UI
             setScanNotification(true);
             setTimeout(() => setScanNotification(false), 3000);
             
             // Light Haptic Feedback
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
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const handleAskAi = async () => {
    setLoadingAi(true);
    const text = await getRewardInsight(user);
    setAiInsight(text);
    setLoadingAi(false);
  };

  // Optimization: Embed name and stamp count for instant scanning
  // If peerId is empty, we send empty string. AdminView handles this now.
  const qrPayload = {
    id: user.id,
    pid: peerId || '',
    n: user.name,
    s: user.stamps,
    m: user.maxStamps
  };
  const qrData = JSON.stringify(qrPayload);

  return (
    <div className="min-h-screen bg-coffee-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-coffee-900">
             <div className="w-8 h-8 bg-coffee-900 rounded-lg flex items-center justify-center">
                 <Coffee size={18} className="text-white" />
             </div>
             <h1 className="font-bold text-lg tracking-tight">StampLink</h1>
          </div>
          <button onClick={onLogout} className="p-2 text-gray-500 hover:text-red-600 rounded-lg flex items-center gap-1.5 text-sm font-bold">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto p-6 flex flex-col gap-6 relative">
        
        {/* Scan Notification Toast */}
        {scanNotification && (
             <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-black/90 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                 <Scan size={18} className="text-brand-400 animate-pulse" />
                 <span className="font-bold text-sm">Admin Connected</span>
             </div>
        )}

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 flex flex-col items-center gap-6 relative">
           <div className="absolute top-4 right-4">
              {isConnected ? (
                  <div className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100 shadow-sm">
                      <Wifi size={12} className="animate-pulse" /> Live
                  </div>
              ) : (
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                      <WifiOff size={12} /> Syncing
                  </div>
              )}
           </div>

           <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-100">
             {/* Always show QR, even if P2P isn't ready yet */}
             <QRCode value={qrData} size={200} level="L" fgColor="#000000" bgColor="#FFFFFF" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-1">{user.name}</h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{user.username}</p>
          </div>
        </div>

        <StampGrid user={user} />

        <div className="bg-brand-50 rounded-2xl p-6 border border-brand-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={100} className="text-brand-500" /></div>
          <div className="flex items-start gap-3 relative z-10">
            <div className="p-2.5 bg-brand-500 rounded-xl text-white shadow-lg shrink-0"><Sparkles size={20} /></div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1">Loyalty Assistant</h3>
              <p className="text-sm text-gray-700 font-medium">{aiInsight || "Ready for your next reward?"}</p>
              {!aiInsight && (
                <button onClick={handleAskAi} disabled={loadingAi} className="mt-3 text-xs font-bold text-brand-700 bg-white border border-brand-200 px-3 py-2 rounded-lg flex items-center gap-2">
                  {loadingAi ? <RefreshCw className="animate-spin" size={12} /> : "Get Update"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 pb-8">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm uppercase tracking-wide opacity-60 ml-1"><History size={16} /> Activity History</h3>
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 shadow-sm">
                {user.history.length > 0 ? user.history.slice(0, 5).map(evt => (
                    <div key={evt.id} className="p-4 flex justify-between items-center">
                        <div>
                            <p className="font-bold text-gray-900 text-sm">{evt.type === 'add' ? 'Stamp Awarded' : 'Redeemed'}</p>
                            <p className="text-xs text-gray-400">{new Date(evt.timestamp).toLocaleString()}</p>
                        </div>
                        <span className={`text-sm font-black px-2 py-1 rounded ${evt.type === 'add' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {evt.type === 'add' ? '+1' : 'USED'}
                        </span>
                    </div>
                )) : (
                  <div className="p-8 text-center text-gray-400 text-sm italic">No stamps collected yet!</div>
                )}
            </div>
        </div>
      </main>
    </div>
  );
};
