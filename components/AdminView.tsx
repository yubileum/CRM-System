
import React, { useState } from 'react';
import { QrCode, LogOut, Check, AlertCircle, User as UserIcon, X, Download, Wifi, RefreshCw, Users, WifiOff, Cloud, Plus, Minus } from 'lucide-react';
import { Scanner } from './Scanner';
import { logAdminTransaction, generateTransactionCSV, generateMembersCSV, applyStampToUser, fetchUserById } from '../services/storage';
import { sendStampSignal, sendScanSignal, fetchRemoteUser } from '../services/connection';
import { User } from '../types';

interface AdminViewProps {
  onLogout: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onLogout }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'syncing'>('idle');
  const [message, setMessage] = useState('');
  
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [pendingPeerId, setPendingPeerId] = useState<string | null>(null);
  const [stampCount, setStampCount] = useState(1);

  const handleScan = async (data: string) => {
    setIsScanning(false);
    setStatus('syncing');
    setMessage('Processing QR Code...');
    
    let json: any = {};
    let userId: string | null = null;
    let peerId: string | null = null;

    // 1. Attempt to parse JSON
    try {
        json = JSON.parse(data);
        userId = json.id || null;
        peerId = json.pid || null;
    } catch(e) {
        // 2. Fallback: Check if it's a raw ID string (e.g. printed card)
        if (typeof data === 'string' && (data.startsWith('user-') || data.startsWith('mem-'))) {
            userId = data;
        }
    }

    // SCENARIO A: We have a User ID (Most Reliable)
    if (userId) {
        setStampCount(1); // Reset counter

        // Notify member immediately if connected
        if (peerId) {
            sendScanSignal(peerId).catch(err => console.warn("Scan signal failed", err));
        }

        // A1: Optimistic - Use embedded data if available (Fastest)
        if (json && json.n && typeof json.s === 'number') {
            setPendingUser({
                id: userId,
                username: 'Member', 
                name: json.n,
                email: '...', 
                phone: '...', 
                stamps: json.s,
                maxStamps: json.m || 10,
                history: [] 
            });
            setPendingPeerId(peerId);
            setStatus('idle');
            return;
        }

        // A2: Database Fetch - If embedded data missing/partial, fetch from Cloud (Robust)
        setMessage('Fetching member from database...');
        try {
            const cloudUser = await fetchUserById(userId);
            if (cloudUser) {
                setPendingUser(cloudUser);
                setPendingPeerId(peerId); // Store peerId if it was in the QR, even if we used Cloud for data
                setStatus('idle');
                return;
            } else {
                setStatus('error');
                setMessage('Member ID not found in database.');
                return;
            }
        } catch (err) {
            setStatus('error');
            setMessage('Network error fetching member.');
            return;
        }
    }

    // SCENARIO B: No ID, but has Peer ID (Legacy P2P Fallback)
    if (peerId) {
        setMessage('Contacting member device (Legacy)...');
        
        // Notify member they are being scanned
        sendScanSignal(peerId).catch(() => {});

        const remoteUser = await fetchRemoteUser(peerId);

        if (remoteUser) {
            setPendingUser(remoteUser);
            setPendingPeerId(peerId);
            setStampCount(1); // Reset counter
            setStatus('idle');
        } else {
            setStatus('error');
            setMessage('Device unreachable & ID missing. Cannot sync.');
            setTimeout(() => setStatus('idle'), 4000);
        }
        return;
    }

    // SCENARIO C: Invalid Data
    setStatus('error');
    setMessage('Invalid QR Code format.');
    setTimeout(() => setStatus('idle'), 3000);
  };

  const confirmAddStamp = async () => {
    if (!pendingUser) return;
    if (status === 'syncing') return; // Prevent double click

    setStatus('syncing');
    setMessage(`Adding ${stampCount} stamp${stampCount > 1 ? 's' : ''}...`);

    try {
        // 1. Update Cloud DB (Persistence) - PRIMARY SOURCE OF TRUTH
        const updatedUser = await applyStampToUser(pendingUser.id, stampCount);

        if (updatedUser) {
            // 2. Log Audit
            logAdminTransaction(pendingUser.id, pendingUser.name, 'add', stampCount);

            // 3. Try to notify User Device (Best Effort / Fire & Forget)
            if (pendingPeerId) {
                // Pass the correct stamp count to the remote device
                sendStampSignal(pendingPeerId, stampCount).catch(err => console.warn("P2P Signal failed", err));
            }
            
            // Success Logic
            setStatus('success');
            setMessage(`Added ${stampCount} stamps for ${pendingUser.name}.`);
            setPendingUser(null); // Close modal immediately on success
        } else {
            setStatus('error');
            setMessage('Database update failed. Check permissions.');
        }
    } catch (err) {
        console.error(err);
        setStatus('error');
        setMessage('Connection failed. Please retry.');
    }

    // Reset status after delay only if we showed an error message (if success, modal is gone)
    if (!pendingUser) {
       setTimeout(() => {
           setStatus('idle');
           setMessage('');
       }, 4000);
    }
  };

  const handleIncrement = () => {
    if (pendingUser && stampCount < (pendingUser.maxStamps - pendingUser.stamps)) {
        setStampCount(c => c + 1);
    }
  };

  const handleDecrement = () => {
    if (stampCount > 1) {
        setStampCount(c => c - 1);
    }
  };

  const downloadReport = () => {
    const csv = generateTransactionCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stamplink_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const downloadMembers = async () => {
    setStatus('syncing');
    setMessage('Fetching member list...');
    const csv = await generateMembersCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stamplink_members_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    setStatus('idle');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col relative font-sans">
       <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-lg flex items-center gap-2 text-brand-400">
            <Cloud size={16} /> Admin Console
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={onLogout} className="p-2 text-gray-400 hover:text-white transition text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <LogOut size={14} /> 
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto p-6 flex flex-col justify-center items-center gap-8">
        
        {status !== 'idle' && (
            <div className={`
                w-full p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 shadow-lg border
                ${status === 'success' ? 'bg-green-900/40 text-green-400 border-green-500/30' : ''}
                ${status === 'error' ? 'bg-red-900/40 text-red-400 border-red-500/30' : ''}
                ${status === 'syncing' ? 'bg-blue-900/40 text-blue-400 border-blue-500/30' : ''}
            `}>
                <div className="shrink-0">
                    {status === 'success' && <Check size={20}/>}
                    {status === 'error' && <AlertCircle size={20}/>}
                    {status === 'syncing' && <RefreshCw size={20} className="animate-spin"/>}
                </div>
                <div className="text-sm font-bold leading-tight">{message}</div>
            </div>
        )}

        <div className="text-center space-y-8 w-full">
            <div className="relative inline-block">
                <div className="w-24 h-24 bg-gray-800 rounded-3xl flex items-center justify-center mx-auto border border-gray-700 shadow-2xl">
                    <QrCode size={40} className="text-brand-400" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-brand-500 p-1.5 rounded-full border-4 border-gray-900">
                   <Wifi size={14} className="text-white" />
                </div>
            </div>
            
            <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Scanner Ready</h2>
                <p className="text-gray-500 max-w-xs mx-auto text-sm font-medium">
                    Link with a member's device to manage their stamp database.
                </p>
            </div>

            <div className="flex flex-col gap-4 w-full">
                <button 
                    onClick={() => setIsScanning(true)}
                    className="w-full bg-brand-600 hover:bg-brand-500 active:scale-95 transition-all text-white font-black py-5 rounded-2xl shadow-xl shadow-brand-900/40 flex items-center justify-center gap-3 text-lg"
                >
                    <QrCode size={24} />
                    <span>Scan Member Code</span>
                </button>

                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={downloadReport}
                        className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 active:scale-95 transition-all text-gray-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"
                    >
                        <Download size={14} />
                        <span>Logs</span>
                    </button>
                    <button 
                        onClick={downloadMembers}
                        className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 active:scale-95 transition-all text-gray-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"
                    >
                        <Users size={14} />
                        <span>Members</span>
                    </button>
                </div>
            </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {pendingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !status.includes('syncing') && setPendingUser(null)}></div>
            <div className="bg-white text-gray-900 w-full max-w-xs rounded-3xl p-6 relative z-10 shadow-2xl animate-in zoom-in-95">
                <button 
                    onClick={() => setPendingUser(null)} 
                    disabled={status === 'syncing'}
                    className="absolute top-4 right-4 text-gray-300 hover:text-gray-900 disabled:opacity-30"
                >
                    <X size={20} />
                </button>
                <div className="flex flex-col items-center text-center gap-6">
                    <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 shadow-inner shrink-0">
                        <UserIcon size={32} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900 leading-none">{pendingUser.name}</h3>
                         <div className={`text-xs font-black mt-2 uppercase tracking-widest flex items-center justify-center gap-1 ${pendingPeerId ? 'text-green-600' : 'text-amber-600'}`}>
                            {pendingPeerId ? <Wifi size={12} /> : <WifiOff size={12} />}
                            {pendingPeerId ? 'Device Online' : 'Cloud Sync'}
                        </div>
                    </div>
                    
                    <div className="w-full bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-3">
                         <div className="flex justify-between items-center text-xs font-bold uppercase text-gray-400 tracking-wider">
                            <span>Current</span>
                            <span>Max</span>
                         </div>
                         <div className="flex justify-between items-center font-mono font-bold text-lg text-gray-900">
                             <span>{pendingUser.stamps}</span>
                             <span className="text-gray-300">/</span>
                             <span>{pendingUser.maxStamps}</span>
                         </div>
                         <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                             <div className="h-full bg-brand-500" style={{ width: `${(pendingUser.stamps / pendingUser.maxStamps) * 100}%` }}></div>
                         </div>
                    </div>

                    <div className="flex items-center gap-4 w-full">
                        <button 
                            onClick={handleDecrement}
                            disabled={stampCount <= 1 || status === 'syncing'}
                            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Minus size={18} />
                        </button>
                        <div className="flex-1 text-center">
                            <span className="text-3xl font-black text-gray-900">{stampCount}</span>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stamps to Add</p>
                        </div>
                        <button 
                            onClick={handleIncrement}
                            disabled={stampCount >= (pendingUser.maxStamps - pendingUser.stamps) || status === 'syncing'}
                            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setPendingUser(null)} 
                            disabled={status === 'syncing'}
                            className="flex-1 py-4 px-4 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmAddStamp} 
                            disabled={status === 'syncing'}
                            className="flex-1 py-4 px-4 rounded-xl font-bold text-white bg-coffee-900 shadow-lg shadow-coffee-900/30 hover:bg-black transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                        >
                            {status === 'syncing' ? <RefreshCw className="animate-spin" size={18} /> : 'Confirm'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {isScanning && <Scanner onScan={handleScan} onClose={() => setIsScanning(false)} />}
    </div>
  );
};
