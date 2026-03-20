import React, { useState } from 'react';
import { Footer } from './Footer';
import { QrCode, LogOut, Check, AlertCircle, User as UserIcon, X, Download, Wifi, RefreshCw, Users, WifiOff, Cloud, Plus, Minus, Palette, Sparkles, TrendingUp, Phone, Globe, Edit3, Award, BarChart2 } from 'lucide-react';
import { Scanner } from './Scanner';
import { BrandSettings } from './BrandSettings';
import { StampConfigModal } from './StampConfigModal';
import { DashboardView } from './DashboardView';
import { logAdminTransaction, generateTransactionCSV, generateMembersCSV, applyStampToUser, resetStampsForUser, fetchUserById, fetchUserByPhone } from '../services/storage';
import { sendStampSignal, sendScanSignal, fetchRemoteUser } from '../services/connection';
import { User } from '../types';
import { getBrandConfig } from '../services/branding';

interface AdminViewProps {
    onLogout: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onLogout }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [showBrandSettings, setShowBrandSettings] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);
    const [showStampConfig, setShowStampConfig] = useState(false);
    const [showDashboard, setShowDashboard] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'syncing'>('idle');
    const [message, setMessage] = useState('');

    const [pendingUser, setPendingUser] = useState<User | null>(null);
    const [pendingPeerId, setPendingPeerId] = useState<string | null>(null);
    const [stampCount, setStampCount] = useState(1);
    const brandConfig = getBrandConfig();

    // Manual input fields
    const [countryCode, setCountryCode] = useState('62');
    const [phone, setPhone] = useState('');

    const handleScan = async (data: string) => {
        setIsScanning(false);
        setStatus('syncing');
        setMessage('Processing QR Code...');

        let json: any = {};
        let userId: string | null = null;
        let peerId: string | null = null;

        try {
            json = JSON.parse(data);
            userId = json.id || null;
            peerId = json.pid || null;
        } catch (e) {
            if (typeof data === 'string' && (data.startsWith('user-') || data.startsWith('mem-'))) {
                userId = data;
            }
        }

        if (userId) {
            setStampCount(1);

            if (peerId) {
                sendScanSignal(peerId).catch(err => console.warn("Scan signal failed", err));
            }

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

            setMessage('Fetching member from database...');
            try {
                const cloudUser = await fetchUserById(userId);
                if (cloudUser) {
                    setPendingUser(cloudUser);
                    setPendingPeerId(peerId);
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

        if (peerId) {
            setMessage('Contacting member device (Legacy)...');

            sendScanSignal(peerId).catch(() => { });

            const remoteUser = await fetchRemoteUser(peerId);

            if (remoteUser) {
                setPendingUser(remoteUser);
                setPendingPeerId(peerId);
                setStampCount(1);
                setStatus('idle');
            } else {
                setStatus('error');
                setMessage('Device unreachable & ID missing. Cannot sync.');
                setTimeout(() => setStatus('idle'), 4000);
            }
            return;
        }

        setStatus('error');
        setMessage('Invalid QR Code format.');
        setTimeout(() => setStatus('idle'), 3000);
    };

    const confirmAddStamp = async () => {
        if (!pendingUser) return;
        if (status === 'syncing') return;

        setStatus('syncing');
        setMessage(`Adding ${stampCount} stamp${stampCount > 1 ? 's' : ''}...`);

        try {
            const updatedUser = await applyStampToUser(pendingUser.id, stampCount);

            if (updatedUser) {
                logAdminTransaction(pendingUser.id, pendingUser.name, 'add', stampCount);

                if (pendingPeerId) {
                    sendStampSignal(pendingPeerId, stampCount).catch(err => console.warn("P2P Signal failed", err));
                }

                setStatus('success');
                setMessage(`Added ${stampCount} stamps for ${pendingUser.name}.`);
                setPendingUser(null);
            } else {
                setStatus('error');
                setMessage('Database update failed. Check permissions.');
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
            setMessage('Connection failed. Please retry.');
        }

        if (!pendingUser) {
            setTimeout(() => {
                setStatus('idle');
                setMessage('');
            }, 4000);
        }
    };

    const confirmResetStamps = async () => {
        if (!pendingUser) return;
        if (status === 'syncing') return;

        setStatus('syncing');
        setMessage('Resetting stamp card...');

        try {
            const updatedUser = await resetStampsForUser(pendingUser.id);

            if (updatedUser) {
                logAdminTransaction(pendingUser.id, pendingUser.name, 'redeem', pendingUser.stamps);

                setStatus('success');
                setMessage(`Stamp card reset for ${pendingUser.name}. Card is now at 0/${pendingUser.maxStamps}.`);
                setPendingUser(null);
            } else {
                setStatus('error');
                setMessage('Reset failed. Check database permissions.');
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
            setMessage('Connection failed. Please retry.');
        }

        setTimeout(() => {
            setStatus('idle');
            setMessage('');
        }, 4000);
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

    // Handle phone number input - only allow digits, no leading 0
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;
        value = value.replace(/\D/g, '');
        value = value.replace(/^0+/, '');
        const maxLength = 12;
        if (value.length > maxLength) {
            value = value.substring(0, maxLength);
        }
        setPhone(value);
    };

    // Handle manual phone number lookup
    const handleManualLookup = async () => {
        if (!phone) {
            setStatus('error');
            setMessage('Please enter a phone number.');
            setTimeout(() => setStatus('idle'), 3000);
            return;
        }

        if (phone.length < 8) {
            setStatus('error');
            setMessage('Please enter a valid phone number.');
            setTimeout(() => setStatus('idle'), 3000);
            return;
        }

        setStatus('syncing');
        setMessage('Looking up member...');

        try {
            const fullPhone = countryCode + phone;

            const user = await fetchUserByPhone(fullPhone);

            if (user) {
                setPendingUser(user);
                setPendingPeerId(null); // No peer connection for manual input
                setStampCount(1);
                setStatus('idle');
                setShowManualInput(false);
                // Clear the form
                setPhone('');
                setCountryCode('62');
            } else {
                setStatus('error');
                setMessage('Member not found. Please check phone number.');
                setTimeout(() => setStatus('idle'), 4000);
            }
        } catch (err: any) {
            setStatus('error');
            setMessage(err.message || 'Member not found. Please check phone number.');
            setTimeout(() => setStatus('idle'), 4000);
        }
    };

    const downloadReport = () => {
        const csv = generateTransactionCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dice_report_${new Date().toISOString().split('T')[0]}.csv`;
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
        a.download = `dice_members_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        setStatus('idle');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex flex-col relative overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDE2YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDQtMS43OSA0LTQgNC00LTEuNzktNC00em0wIDI0YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDQtMS43OSA0LTQgNC00LTEuNzktNC00ek0xMiAxNmMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHptMCAyNGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50"></div>
            <div className="absolute top-20 right-20 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-20 left-20 w-80 h-80 bg-brand-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

            {/* Header */}
            <header className="relative z-10 bg-gray-900/80 backdrop-blur-xl border-b border-gray-700/50 sticky top-0 shadow-xl">
                <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30">
                            <Cloud size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-black text-xl text-white">{brandConfig.name}</h1>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Admin Console</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowDashboard(true)}
                            className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                            title="Analytics Dashboard"
                        >
                            <BarChart2 size={18} />
                        </button>
                        <button
                            onClick={() => setShowStampConfig(true)}
                            className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                            title="Stamp Configuration"
                        >
                            <Award size={18} />
                        </button>
                        <button
                            onClick={() => setShowBrandSettings(true)}
                            className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                            title="Brand Settings"
                        >
                            <Palette size={18} />
                        </button>
                        <button
                            onClick={onLogout}
                            className="px-4 py-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all flex items-center gap-2 font-bold"
                        >
                            <LogOut size={18} />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="relative z-10 flex-1 max-w-2xl w-full mx-auto p-6 flex flex-col justify-center items-center gap-6">

                {/* Status Message */}
                {status !== 'idle' && (
                    <div className={`
                w-full p-5 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 shadow-2xl border-2
                ${status === 'success' ? 'bg-green-900/40 text-green-300 border-green-500/50 backdrop-blur-xl' : ''}
                ${status === 'error' ? 'bg-red-900/40 text-red-300 border-red-500/50 backdrop-blur-xl' : ''}
                ${status === 'syncing' ? 'bg-blue-900/40 text-blue-300 border-blue-500/50 backdrop-blur-xl' : ''}
            `}>
                        <div className="shrink-0">
                            {status === 'success' && <Check size={24} />}
                            {status === 'error' && <AlertCircle size={24} />}
                            {status === 'syncing' && <RefreshCw size={24} className="animate-spin" />}
                        </div>
                        <div className="text-sm font-bold leading-tight">{message}</div>
                    </div>
                )}

                {/* Main Card */}
                <div className="w-full bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
                    <div className="text-center space-y-6">
                        {/* Icon */}
                        <div className="relative inline-block">
                            <div className="w-24 h-24 bg-gradient-to-br from-brand-500 to-brand-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-brand-500/30">
                                <QrCode size={48} className="text-white" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-green-500 p-2 rounded-full border-4 border-gray-900 shadow-lg">
                                <Wifi size={16} className="text-white" />
                            </div>
                        </div>

                        {/* Text */}
                        <div>
                            <h2 className="text-3xl font-black tracking-tight text-white mb-2">Scanner Ready</h2>
                            <p className="text-gray-400 max-w-sm mx-auto font-medium">
                                Scan member QR codes to manage stamps and rewards
                            </p>
                        </div>

                        {/* Main Action Button */}
                        <button
                            onClick={() => setIsScanning(true)}
                            className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 active:scale-[0.98] transition-all text-white font-black py-5 rounded-2xl shadow-xl shadow-brand-500/30 flex items-center justify-center gap-3 text-lg group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                            <QrCode size={24} className="relative" />
                            <span className="relative">Scan Member Code</span>
                        </button>

                        {/* Manual Input Button */}
                        <button
                            onClick={() => setShowManualInput(true)}
                            className="w-full bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-800 hover:to-gray-700 active:scale-[0.98] transition-all text-white font-black py-5 rounded-2xl shadow-xl shadow-gray-500/20 flex items-center justify-center gap-3 text-lg group relative overflow-hidden mt-3"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                            <Edit3 size={24} className="relative" />
                            <span className="relative">Manual Phone Input</span>
                        </button>

                        {/* Secondary Actions */}
                        <div className="grid grid-cols-2 gap-3 pt-4">
                            <button
                                onClick={downloadReport}
                                className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 active:scale-95 transition-all text-gray-300 font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                            >
                                <Download size={16} />
                                Logs
                            </button>
                            <button
                                onClick={downloadMembers}
                                className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 active:scale-95 transition-all text-gray-300 font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                            >
                                <Users size={16} />
                                Members
                            </button>
                        </div>
                    </div>
                </div>

                <Footer light />
            </main>

            {/* Confirmation Modal */}
            {pendingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="absolute inset-0" onClick={() => !status.includes('syncing') && setPendingUser(null)}></div>
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 w-full max-w-md rounded-3xl p-8 relative z-10 shadow-2xl border border-gray-700 animate-in zoom-in-95">
                        <button
                            onClick={() => setPendingUser(null)}
                            disabled={status === 'syncing'}
                            className="absolute top-6 right-6 text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="flex flex-col items-center text-center gap-6">
                            {/* User Avatar */}
                            <div className="w-20 h-20 bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand-500/30">
                                <span className="text-3xl font-black">{pendingUser.name.charAt(0)}</span>
                            </div>

                            {/* User Info */}
                            <div>
                                <h3 className="text-2xl font-black text-white leading-none mb-2">{pendingUser.name}</h3>
                                <div className={`inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${pendingPeerId ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                                    {pendingPeerId ? <Wifi size={14} /> : <WifiOff size={14} />}
                                    {pendingPeerId ? 'Device Online' : 'Cloud Sync'}
                                </div>
                            </div>

                            {/* Progress Card */}
                            <div className="w-full bg-gray-700/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-600">
                                <div className="flex justify-between items-center text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">
                                    <span>Current</span>
                                    <span>Max</span>
                                </div>
                                <div className="flex justify-between items-center font-mono font-bold text-2xl text-white mb-4">
                                    <span>{pendingUser.stamps}</span>
                                    <span className="text-gray-600">/</span>
                                    <span>{pendingUser.maxStamps}</span>
                                </div>
                                <div className="h-3 w-full bg-gray-600 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500"
                                        style={{ width: `${(pendingUser.stamps / pendingUser.maxStamps) * 100}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Stamp Full: Reset UI — or normal stamp counter */}
                            {pendingUser.stamps >= pendingUser.maxStamps ? (
                                <>
                                    {/* Full card notice */}
                                    <div className="w-full bg-green-900/30 border border-green-500/40 rounded-2xl p-4 text-center">
                                        <p className="text-green-400 font-black text-lg">🎉 Stamp Card Full!</p>
                                        <p className="text-green-300/80 text-sm mt-1 font-medium">Reset to 0 after redeeming the reward.</p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 w-full mt-2">
                                        <button
                                            onClick={() => setPendingUser(null)}
                                            disabled={status === 'syncing'}
                                            className="flex-1 py-4 px-4 rounded-xl font-bold text-gray-400 bg-gray-700/50 hover:bg-gray-700 transition-colors disabled:opacity-50 border border-gray-600"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={confirmResetStamps}
                                            disabled={status === 'syncing'}
                                            className="flex-1 py-4 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 shadow-lg shadow-green-500/30 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                                        >
                                            {status === 'syncing' ? <RefreshCw className="animate-spin" size={20} /> : <><RefreshCw size={20} /> Reset Stamps</>}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Stamp Counter */}
                                    <div className="flex items-center gap-4 w-full">
                                        <button
                                            onClick={handleDecrement}
                                            disabled={stampCount <= 1 || status === 'syncing'}
                                            className="w-14 h-14 rounded-xl bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        >
                                            <Minus size={24} />
                                        </button>
                                        <div className="flex-1 text-center">
                                            <span className="text-5xl font-black text-white">{stampCount}</span>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Stamps to Add</p>
                                        </div>
                                        <button
                                            onClick={handleIncrement}
                                            disabled={stampCount >= (pendingUser.maxStamps - pendingUser.stamps) || status === 'syncing'}
                                            className="w-14 h-14 rounded-xl bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        >
                                            <Plus size={24} />
                                        </button>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 w-full mt-2">
                                        <button
                                            onClick={() => setPendingUser(null)}
                                            disabled={status === 'syncing'}
                                            className="flex-1 py-4 px-4 rounded-xl font-bold text-gray-400 bg-gray-700/50 hover:bg-gray-700 transition-colors disabled:opacity-50 border border-gray-600"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={confirmAddStamp}
                                            disabled={status === 'syncing'}
                                            className="flex-1 py-4 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 shadow-lg shadow-brand-500/30 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                                        >
                                            {status === 'syncing' ? <RefreshCw className="animate-spin" size={20} /> : <><Check size={20} /> Confirm</>}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Input Modal */}
            {showManualInput && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="absolute inset-0" onClick={() => !status.includes('syncing') && setShowManualInput(false)}></div>
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 w-full max-w-md rounded-3xl p-8 relative z-10 shadow-2xl border border-gray-700 animate-in zoom-in-95">
                        <button
                            onClick={() => setShowManualInput(false)}
                            disabled={status === 'syncing'}
                            className="absolute top-6 right-6 text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="flex flex-col items-center text-center gap-6">
                            {/* Icon */}
                            <div className="w-20 h-20 bg-gradient-to-br from-gray-700 to-gray-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
                                <Edit3 size={40} />
                            </div>

                            {/* Title */}
                            <div>
                                <h3 className="text-2xl font-black text-white leading-none mb-2">Manual Phone Input</h3>
                                <p className="text-gray-400 text-sm font-medium">Enter member's phone number to lookup</p>
                            </div>

                            {/* Form */}
                            <div className="w-full space-y-4">
                                {/* Phone Number with Country Code Input */}
                                <div className="space-y-1.5 text-left">
                                    <label className="block text-sm font-bold text-white tracking-tight">
                                        Phone Number <span className="text-red-400">*</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative group w-24">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-400 transition-colors">
                                                <Globe size={18} />
                                            </div>
                                            <input
                                                type="text"
                                                value={countryCode}
                                                onChange={(e) => {
                                                    let value = e.target.value;
                                                    value = value.replace(/\D/g, '');
                                                    setCountryCode(value);
                                                }}
                                                placeholder="62"
                                                className="w-full pl-10 pr-2 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder:text-gray-500 focus:bg-gray-700 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 outline-none transition-all font-bold text-center hover:border-gray-500"
                                            />
                                        </div>

                                        <div className="relative flex-1 group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-400 transition-colors">
                                                <Phone size={18} />
                                            </div>
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={handlePhoneChange}
                                                placeholder="8123456789"
                                                className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-gray-600 bg-gray-700/50 text-white placeholder:text-gray-500 focus:bg-gray-700 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 outline-none transition-all font-medium hover:border-gray-500"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                                        <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                                        Enter country code and phone number separately
                                    </p>
                                </div>

                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 w-full mt-2">
                            <button
                                onClick={() => {
                                    setShowManualInput(false);
                                    setPhone('');
                                    setCountryCode('62');
                                }}
                                disabled={status === 'syncing'}
                                className="flex-1 py-4 px-4 rounded-xl font-bold text-gray-400 bg-gray-700/50 hover:bg-gray-700 transition-colors disabled:opacity-50 border border-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleManualLookup}
                                disabled={status === 'syncing' || !phone}
                                className="flex-1 py-4 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 shadow-lg shadow-brand-500/30 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                            >
                                {status === 'syncing' ? <><RefreshCw className="animate-spin" size={20} /> Looking up...</> : <><Phone size={20} /> Lookup Member</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isScanning && <Scanner onScan={handleScan} onClose={() => setIsScanning(false)} />}
            {showBrandSettings && <BrandSettings onClose={() => setShowBrandSettings(false)} />}
            {showStampConfig && <StampConfigModal onClose={() => setShowStampConfig(false)} />}
            {showDashboard && <DashboardView onClose={() => setShowDashboard(false)} />}
        </div>
    );
};
