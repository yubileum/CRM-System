import React, { useState, useEffect } from 'react';
import { Voucher } from '../types';
import { Gift, Clock, CheckCircle, XCircle, Ticket } from 'lucide-react';
import { getBrandConfig } from '../services/branding';
import { getUserVouchers, getTimeUntilExpiry, isVoucherExpired } from '../services/voucherService';

interface MyVouchersProps {
    userId: string;
    onUseVoucher: (voucher: Voucher) => void;
    onClose: () => void;
}

type FilterType = 'all' | 'active' | 'used' | 'expired';

export const MyVouchers: React.FC<MyVouchersProps> = ({ userId, onUseVoucher, onClose }) => {
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const brandConfig = getBrandConfig();

    useEffect(() => {
        loadVouchers();
    }, [userId]);

    const loadVouchers = async () => {
        setLoading(true);
        try {
            const data = await getUserVouchers(userId, true);
            setVouchers(data);
        } catch (error) {
            console.error('Failed to load vouchers:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredVouchers = vouchers.filter(v => {
        if (filter === 'all') return true;
        if (filter === 'active') return v.status === 'active' && !isVoucherExpired(v);
        if (filter === 'used') return v.status === 'redeemed';
        if (filter === 'expired') return v.status === 'expired' || isVoucherExpired(v);
        return true;
    });

    const counts = {
        all: vouchers.length,
        active: vouchers.filter(v => v.status === 'active' && !isVoucherExpired(v)).length,
        used: vouchers.filter(v => v.status === 'redeemed').length,
        expired: vouchers.filter(v => v.status === 'expired' || isVoucherExpired(v)).length
    };

    const getStatusBadge = (voucher: Voucher) => {
        const expired = isVoucherExpired(voucher);

        if (voucher.status === 'redeemed') {
            return (
                <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                    <CheckCircle size={14} />
                    <span>Used</span>
                </div>
            );
        }

        if (expired || voucher.status === 'expired') {
            return (
                <div className="flex items-center gap-1 text-red-600 text-xs font-semibold">
                    <XCircle size={14} />
                    <span>Expired</span>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Active</span>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 bg-white">
            {/* Header */}
            <div
                className="sticky top-0 z-10 shadow-md"
                style={{
                    background: `linear-gradient(135deg, ${brandConfig.primaryColor} 0%, ${brandConfig.primaryColor}dd 100%)`
                }}
            >
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Ticket size={28} className="text-white" />
                            <h1 className="text-2xl font-bold text-white">My Vouchers</h1>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
                        >
                            <XCircle size={24} />
                        </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {(['all', 'active', 'used', 'expired'] as FilterType[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${filter === f
                                        ? 'bg-white text-gray-800 shadow-lg'
                                        : 'bg-white/20 text-white hover:bg-white/30'
                                    }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 pb-20">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div
                                className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                                style={{ borderColor: `${brandConfig.primaryColor}40`, borderTopColor: brandConfig.primaryColor }}
                            />
                            <p className="text-gray-600">Loading vouchers...</p>
                        </div>
                    </div>
                ) : filteredVouchers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Gift size={64} className="text-gray-300 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">
                            {filter === 'all' ? 'No vouchers yet' : `No ${filter} vouchers`}
                        </h3>
                        <p className="text-gray-600 max-w-sm">
                            {filter === 'all'
                                ? 'Collect stamps to earn vouchers at checkpoints!'
                                : `You don't have any ${filter} vouchers at the moment.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredVouchers.map(voucher => {
                            const expired = isVoucherExpired(voucher);
                            const canUse = voucher.status === 'active' && !expired;

                            return (
                                <div
                                    key={voucher.id}
                                    className={`bg-white rounded-2xl shadow-md overflow-hidden border-2 transition-all ${canUse ? 'border-green-200 hover:shadow-lg' : 'border-gray-200 opacity-75'
                                        }`}
                                >
                                    <div className="p-4">
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-start gap-3 flex-1">
                                                <div
                                                    className="p-3 rounded-xl"
                                                    style={{
                                                        background: canUse
                                                            ? `${brandConfig.primaryColor}20`
                                                            : '#f3f4f6'
                                                    }}
                                                >
                                                    <Gift
                                                        size={24}
                                                        style={{
                                                            color: canUse ? brandConfig.primaryColor : '#9ca3af'
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-bold text-gray-800 mb-1">
                                                        {voucher.rewardName}
                                                    </h3>
                                                    <p className="text-xs text-gray-500">
                                                        {voucher.checkpointStampCount} stamps checkpoint
                                                    </p>
                                                </div>
                                            </div>
                                            {getStatusBadge(voucher)}
                                        </div>

                                        {/* Expiry Info */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <Clock
                                                size={14}
                                                className={expired ? 'text-red-500' : 'text-gray-500'}
                                            />
                                            <span className={`text-xs ${expired ? 'text-red-500 font-semibold' : 'text-gray-600'}`}>
                                                {expired ? 'Expired' : getTimeUntilExpiry(voucher)}
                                            </span>
                                            {voucher.status === 'redeemed' && voucher.redeemedAt && (
                                                <span className="text-xs text-gray-500">
                                                    • Redeemed {new Date(voucher.redeemedAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>

                                        {/* Action Button */}
                                        {canUse && (
                                            <button
                                                onClick={() => onUseVoucher(voucher)}
                                                className="w-full py-3 rounded-xl font-semibold text-white shadow-md transform transition-all hover:scale-105 active:scale-95"
                                                style={{
                                                    background: `linear-gradient(135deg, ${brandConfig.primaryColor} 0%, ${brandConfig.primaryColor}dd 100%)`
                                                }}
                                            >
                                                Use Now
                                            </button>
                                        )}

                                        {/* Voucher Code */}
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                            <p className="text-xs text-gray-400 font-mono text-center">
                                                {voucher.id}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
