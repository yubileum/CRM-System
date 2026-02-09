import React, { useEffect, useRef, useState } from 'react';
import { Coffee, Gift, Sparkles, Star, Zap } from 'lucide-react';
import { User, StampConfig } from '../types';
import { getBrandConfig } from '../services/branding';
import { getStampConfig, fetchStampConfig, isCheckpoint, getCheckpointReward } from '../services/stampConfig';

interface StampGridProps {
  user: User;
}

export const StampGrid: React.FC<StampGridProps> = ({ user }) => {
  const [stampConfig, setStampConfig] = useState<StampConfig>(getStampConfig());
  const totalSlots = stampConfig.maxStamps;
  const filledSlots = Math.min(user.stamps, totalSlots);
  const prevStampsRef = useRef(filledSlots);
  const [newStampIndex, setNewStampIndex] = useState<number | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<{ stampCount: number; reward: string } | null>(null);
  const brandConfig = getBrandConfig();

  // No need to fetch on mount - getStampConfig() handles caching and background refresh
  // Config will update automatically when cache refreshes

  // Calculate next checkpoint
  const nextCheckpoint = stampConfig.checkpoints
    .filter(cp => cp.stampCount > filledSlots)
    .sort((a, b) => a.stampCount - b.stampCount)[0];

  useEffect(() => {
    if (filledSlots > prevStampsRef.current) {
      setNewStampIndex(filledSlots - 1);

      const timer = setTimeout(() => {
        setNewStampIndex(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
    prevStampsRef.current = filledSlots;
  }, [filledSlots]);

  return (
    <div className="w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-200 relative overflow-hidden">

      {/* Celebration Overlay */}
      {newStampIndex !== null && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-green-400/20 to-green-500/10 animate-pulse"></div>
          <div className="bg-white/95 backdrop-blur-md px-8 py-4 rounded-2xl shadow-2xl border-2 border-green-400 flex items-center gap-3 animate-bounce">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
              <Sparkles className="text-white" size={24} />
            </div>
            <span className="font-black text-green-800 text-xl">Stamp Added!</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-gray-900 leading-none flex items-center gap-2">
            <Star size={20} sm:size={24} className="text-brand-500" />
            Loyalty Card
          </h3>
          <p className="text-[10px] sm:text-sm text-gray-600 font-medium mt-1.5">Collect {totalSlots} stamps for your reward</p>
        </div>
        <div className="bg-gradient-to-br from-brand-500 to-brand-600 text-white px-3 py-2 sm:px-5 sm:py-3 rounded-2xl shadow-lg shadow-brand-500/30">
          <p className="text-[10px] font-bold opacity-90">Progress</p>
          <p className="text-xl sm:text-2xl font-black">{filledSlots}<span className="text-xs sm:text-sm opacity-75">/{totalSlots}</span></p>
        </div>
      </div>

      {/* Stamp Grid */}
      <div className="grid grid-cols-5 gap-2 sm:gap-4 relative z-0 mb-8">
        {Array.from({ length: totalSlots }).map((_, index) => {
          const stampNumber = index + 1;
          const isFilled = index < filledSlots;
          const isLast = index === totalSlots - 1;
          const isNew = index === newStampIndex;
          const isCheckpointStamp = isCheckpoint(stampNumber);
          const checkpointReward = getCheckpointReward(stampNumber);

          return (
            <div
              key={index}
              className="relative group"
            >
              <div
                onClick={() => {
                  if (isCheckpointStamp && checkpointReward) {
                    setSelectedCheckpoint({ stampCount: stampNumber, reward: checkpointReward });
                  }
                }}
                className={`
                  aspect-square rounded-2xl flex items-center justify-center border-3 transition-all duration-700 relative
                  ${isCheckpointStamp ? 'cursor-pointer' : ''}
                  ${isNew ? 'scale-110 bg-gradient-to-br from-green-500 to-green-600 border-green-400 z-20 shadow-2xl shadow-green-500/50' : ''}
                  ${!isNew && isFilled
                    ? isCheckpointStamp
                      ? 'bg-gradient-to-br from-yellow-500 to-amber-500 border-yellow-400 text-white shadow-xl shadow-yellow-500/40 scale-100 hover:scale-105'
                      : 'bg-white border-brand-200 md:border-2 shadow-lg shadow-brand-500/10 scale-100 hover:scale-105'
                    : !isNew
                      ? isCheckpointStamp
                        ? 'bg-gray-100 border-yellow-300 border-2 border-dashed text-gray-400 scale-95 hover:scale-100'
                        : 'bg-gray-100 border-gray-300 text-gray-400 scale-95 hover:scale-100'
                      : ''
                  }
                `}
              >
                {isFilled ? (
                  isCheckpointStamp ? (
                    <div className="relative">
                      <Star size={28} className={`${isNew ? 'text-white animate-bounce' : 'fill-current'}`} />
                      {!isNew && <Sparkles size={14} className="absolute -top-1 -right-1 text-white animate-pulse" />}
                    </div>
                  ) : isLast ? (
                    <div className="relative">
                      <Gift size={28} className={isNew ? 'text-white animate-bounce' : 'animate-pulse'} />
                      {!isNew && <Sparkles size={14} className="absolute -top-1 -right-1 text-yellow-300 animate-pulse" />}
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center p-1 sm:p-2">
                      <img
                        src="/dice-logo.png"
                        alt="Stamped"
                        className={`w-full h-full object-contain ${isNew ? 'animate-bounce' : ''}`}
                      />
                    </div>
                  )
                ) : (
                  isCheckpointStamp ? (
                    <Star size={20} className="text-gray-400" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                  )
                )}

                {/* Stamp number */}
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-black border shadow-sm ${isCheckpointStamp && isFilled ? 'bg-yellow-400 text-yellow-900 border-yellow-500' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {stampNumber}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Message */}
      <div className="text-center">
        {filledSlots >= totalSlots ? (
          <div className="p-5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl border-2 border-green-400 flex items-center justify-center gap-3 shadow-xl shadow-green-500/30 animate-pulse">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Gift size={28} className="animate-bounce" />
            </div>
            <div className="text-left">
              <p className="font-black text-xl">Reward Ready!</p>
              <p className="text-sm font-medium text-white/90">Show this card to redeem your free item</p>
            </div>
          </div>
        ) : (
          <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap size={18} className="text-brand-500" />
              <p className="text-gray-900 font-black text-base sm:text-lg">
                {nextCheckpoint
                  ? `${nextCheckpoint.stampCount - filledSlots} more stamp${nextCheckpoint.stampCount - filledSlots !== 1 ? 's' : ''} to get ${nextCheckpoint.reward}!`
                  : `${totalSlots - filledSlots} stamp${totalSlots - filledSlots !== 1 ? 's' : ''} to go!`
                }
              </p>
            </div>
            <p className="text-sm text-gray-600 font-medium">
              {nextCheckpoint
                ? `Next milestone at ${nextCheckpoint.stampCount} stamps`
                : 'Keep collecting to unlock your reward'
              }
            </p>
          </div>
        )}
      </div>

      {/* Individual Checkpoint Popup */}
      {
        selectedCheckpoint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedCheckpoint(null)}>
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setSelectedCheckpoint(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                ✕
              </button>

              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Star size={40} className="text-white fill-current" />
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-4xl font-black text-yellow-600">{selectedCheckpoint.stampCount}</span>
                    <span className="text-lg font-bold text-gray-600">stamps</span>
                  </div>
                  <div className="inline-block px-4 py-2 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl border-2 border-yellow-200">
                    <p className="text-sm font-bold text-gray-500 mb-1">Milestone Reward</p>
                    <p className="text-xl font-black text-gray-900">{selectedCheckpoint.reward}</p>
                  </div>
                </div>

                {filledSlots >= selectedCheckpoint.stampCount ? (
                  <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-xl">
                    <p className="font-bold flex items-center justify-center gap-2">
                      ✓ Unlocked!
                    </p>
                    <p className="text-xs mt-1">You've reached this milestone</p>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-gray-100 text-gray-600 rounded-xl">
                    <p className="font-bold">
                      {selectedCheckpoint.stampCount - filledSlots} more stamp{selectedCheckpoint.stampCount - filledSlots !== 1 ? 's' : ''} needed
                    </p>
                    <p className="text-xs mt-1">Keep collecting to unlock this reward!</p>
                  </div>
                )}

                <button
                  onClick={() => setSelectedCheckpoint(null)}
                  className="mt-6 w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-bold rounded-xl transition-all shadow-lg"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};
