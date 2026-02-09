import React, { useState, useRef, useEffect } from 'react';
import { Voucher } from '../types';
import QRCode from 'react-qr-code';
import { X, ChevronRight, Clock, CheckCircle, Gift } from 'lucide-react';
import { getBrandConfig } from '../services/branding';
import { getTimeUntilExpiry, isVoucherExpired } from '../services/voucherService';

interface VoucherRedemptionPopupProps {
    voucher: Voucher;
    onRedeem: () => Promise<void>;
    onClose: () => void;
}

export const VoucherRedemptionPopup: React.FC<VoucherRedemptionPopupProps> = ({
    voucher,
    onRedeem,
    onClose
}) => {
    const [slidePosition, setSlidePosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [isRedeemed, setIsRedeemed] = useState(false);
    const sliderRef = useRef<HTMLDivElement>(null);
    const brandConfig = getBrandConfig();

    const SLIDE_THRESHOLD = 0.8; // 80% of slider width

    const handleStart = (clientX: number) => {
        if (isRedeeming || isRedeemed) return;
        setIsDragging(true);
    };

    const handleMove = (clientX: number) => {
        if (!isDragging || !sliderRef.current) return;

        const rect = sliderRef.current.getBoundingClientRect();
        const maxSlide = rect.width - 60; // 60px is button width
        const newPosition = Math.max(0, Math.min(clientX - rect.left - 30, maxSlide));
        setSlidePosition(newPosition);

        // Check if threshold reached
        if (newPosition >= maxSlide * SLIDE_THRESHOLD) {
            handleRedemption();
        }
    };

    const handleEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);

        // Reset if not reached threshold
        if (!isRedeeming && !isRedeemed) {
            setSlidePosition(0);
        }
    };

    const handleRedemption = async () => {
        if (isRedeeming || isRedeemed) return;

        setIsRedeeming(true);
        setIsDragging(false);

        // Complete the slide animation
        if (sliderRef.current) {
            const rect = sliderRef.current.getBoundingClientRect();
            setSlidePosition(rect.width - 60);
        }

        try {
            await onRedeem();
            setIsRedeemed(true);

            // Auto-close after success animation
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (error) {
            console.error('Redemption failed:', error);
            setIsRedeeming(false);
            setSlidePosition(0);
        }
    };

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        handleStart(e.clientX);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        handleMove(e.clientX);
    };

    const handleMouseUp = () => {
        handleEnd();
    };

    // Touch events
    const handleTouchStart = (e: React.TouchEvent) => {
        handleStart(e.touches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        handleMove(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
        handleEnd();
    };

    // Global mouse up listener
    useEffect(() => {
        const handleGlobalMouseUp = () => handleEnd();
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [isDragging]);

    const expired = isVoucherExpired(voucher);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                >
                    <X size={24} className="text-gray-600" />
                </button>

                {/* Header */}
                <div
                    className="relative h-40 rounded-t-3xl overflow-hidden"
                    style={{
                        background: `linear-gradient(135deg, ${brandConfig.primaryColor} 0%, ${brandConfig.primaryColor}dd 100%)`
                    }}
                >
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-white">
                            <Gift size={48} className="mx-auto mb-2" />
                            <h2 className="text-2xl font-bold">Your Voucher</h2>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Reward Name */}
                    <div className="text-center">
                        <h3 className="text-3xl font-bold text-gray-800 mb-2">
                            {voucher.rewardName}
                        </h3>
                        <div className="flex items-center justify-center gap-2 text-sm">
                            <Clock size={16} className={expired ? 'text-red-500' : 'text-gray-600'} />
                            <span className={expired ? 'text-red-500 font-semibold' : 'text-gray-600'}>
                                {expired ? 'Expired' : getTimeUntilExpiry(voucher)}
                            </span>
                        </div>
                    </div>

                    {/* QR Code */}
                    <div className="bg-white p-6 rounded-2xl border-4 border-gray-200 shadow-inner">
                        <div className="bg-white p-4 rounded-xl">
                            <QRCode
                                value={voucher.id}
                                size={200}
                                className="mx-auto"
                                level="H"
                            />
                        </div>
                        <p className="text-center text-xs text-gray-500 mt-3 font-mono">
                            {voucher.id}
                        </p>
                    </div>

                    {/* Voucher Details */}
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Checkpoint:</span>
                            <span className="font-semibold text-gray-800">
                                {voucher.checkpointStampCount} stamps
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Issued:</span>
                            <span className="font-semibold text-gray-800">
                                {new Date(voucher.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Expires:</span>
                            <span className={`font-semibold ${expired ? 'text-red-500' : 'text-gray-800'}`}>
                                {new Date(voucher.expiresAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>

                    {/* Instructions */}
                    {!isRedeemed && !expired && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-sm text-blue-800 text-center">
                                <strong>Show this to the cashier</strong>
                                <br />
                                Then slide below to confirm redemption
                            </p>
                        </div>
                    )}

                    {/* Success Message */}
                    {isRedeemed && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                            <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-green-800">Voucher Redeemed!</p>
                                <p className="text-xs text-green-600">Enjoy your reward 🎉</p>
                            </div>
                        </div>
                    )}

                    {/* Expired Message */}
                    {expired && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                            <p className="text-sm font-semibold text-red-800">This voucher has expired</p>
                            <p className="text-xs text-red-600 mt-1">Cannot be redeemed</p>
                        </div>
                    )}

                    {/* Swipe to Redeem Slider */}
                    {!isRedeemed && !expired && (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-500 text-center">Swipe to redeem</p>
                            <div
                                ref={sliderRef}
                                className="relative h-16 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full overflow-hidden shadow-inner"
                                onMouseMove={handleMouseMove}
                            >
                                {/* Progress Fill */}
                                <div
                                    className="absolute inset-y-0 left-0 transition-all duration-200"
                                    style={{
                                        width: `${slidePosition + 60}px`,
                                        background: `linear-gradient(90deg, ${brandConfig.primaryColor} 0%, ${brandConfig.primaryColor}dd 100%)`,
                                        opacity: 0.3
                                    }}
                                />

                                {/* Slide Button */}
                                <div
                                    className={`absolute top-2 left-2 w-12 h-12 rounded-full shadow-lg flex items-center justify-center cursor-grab transition-all ${isDragging ? 'cursor-grabbing scale-110' : ''
                                        } ${isRedeeming ? 'animate-pulse' : ''}`}
                                    style={{
                                        transform: `translateX(${slidePosition}px)`,
                                        background: isRedeeming
                                            ? `linear-gradient(135deg, ${brandConfig.primaryColor} 0%, ${brandConfig.primaryColor}dd 100%)`
                                            : 'white'
                                    }}
                                    onMouseDown={handleMouseDown}
                                    onMouseUp={handleMouseUp}
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                >
                                    {isRedeeming ? (
                                        <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <ChevronRight
                                            size={24}
                                            style={{ color: brandConfig.primaryColor }}
                                        />
                                    )}
                                </div>

                                {/* Slide Text */}
                                {!isDragging && slidePosition === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-gray-600 font-semibold text-sm">
                                            Slide to confirm →
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
