import React, { useEffect, useState } from 'react';
import { Voucher } from '../types';
import { Gift, Sparkles, X, Clock } from 'lucide-react';
import { getBrandConfig } from '../services/branding';
import { getTimeUntilExpiry } from '../services/voucherService';

interface CheckpointRewardPopupProps {
    voucher: Voucher;
    onUseNow: () => void;
    onSaveLater: () => void;
}

export const CheckpointRewardPopup: React.FC<CheckpointRewardPopupProps> = ({
    voucher,
    onUseNow,
    onSaveLater
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const brandConfig = getBrandConfig();

    useEffect(() => {
        // Trigger animation after mount
        setTimeout(() => setIsVisible(true), 100);
    }, []);

    const handleClose = (action: 'use' | 'save') => {
        setIsVisible(false);
        setTimeout(() => {
            if (action === 'use') {
                onUseNow();
            } else {
                onSaveLater();
            }
        }, 300);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            {/* Confetti Animation */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(30)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute animate-confetti"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: '-10%',
                            animationDelay: `${Math.random() * 2}s`,
                            animationDuration: `${2 + Math.random() * 2}s`
                        }}
                    >
                        <Sparkles
                            className="text-yellow-400"
                            size={16 + Math.random() * 16}
                            style={{ opacity: 0.6 + Math.random() * 0.4 }}
                        />
                    </div>
                ))}
            </div>

            {/* Popup Card */}
            <div
                className={`relative bg-white rounded-3xl shadow-2xl max-w-md w-full transform transition-all duration-500 ${isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                    }`}
            >
                {/* Header with gradient */}
                <div
                    className="relative h-48 rounded-t-3xl overflow-hidden"
                    style={{
                        background: `linear-gradient(135deg, ${brandConfig.primaryColor} 0%, ${brandConfig.primaryColor}dd 100%)`
                    }}
                >
                    {/* Decorative circles */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

                    {/* Content */}
                    <div className="relative h-full flex flex-col items-center justify-center text-white p-6">
                        <div className="mb-4 animate-bounce">
                            <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
                                <Gift size={48} className="text-white" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-center mb-2">
                            🎉 Checkpoint Reached!
                        </h2>
                        <p className="text-white/90 text-center text-sm">
                            You've earned {voucher.checkpointStampCount} stamps
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Reward Info */}
                    <div className="text-center">
                        <div className="inline-block bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-2 rounded-full text-sm font-semibold mb-3">
                            Your Reward
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">
                            {voucher.rewardName}
                        </h3>
                        <div className="flex items-center justify-center gap-2 text-gray-600 text-sm">
                            <Clock size={16} />
                            <span>Valid for {getTimeUntilExpiry(voucher)}</span>
                        </div>
                    </div>

                    {/* Voucher Preview */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border-2 border-dashed border-gray-300">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-3 rounded-xl shadow-sm">
                                <Gift size={24} style={{ color: brandConfig.primaryColor }} />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Voucher Code</p>
                                <p className="text-sm font-mono font-semibold text-gray-800">
                                    {voucher.id.substring(0, 16)}...
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={() => handleClose('use')}
                            className="w-full py-4 rounded-xl font-semibold text-white shadow-lg transform transition-all hover:scale-105 active:scale-95"
                            style={{
                                background: `linear-gradient(135deg, ${brandConfig.primaryColor} 0%, ${brandConfig.primaryColor}dd 100%)`
                            }}
                        >
                            Use Now
                        </button>
                        <button
                            onClick={() => handleClose('save')}
                            className="w-full py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transform transition-all hover:scale-105 active:scale-95"
                        >
                            Save for Later
                        </button>
                    </div>

                    {/* Info Text */}
                    <p className="text-xs text-gray-500 text-center">
                        You can find this voucher in "My Vouchers" anytime
                    </p>
                </div>
            </div>

            <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear infinite;
        }
      `}</style>
        </div>
    );
};
