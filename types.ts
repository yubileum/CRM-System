export interface User {
  id: string;
  username: string;
  password?: string; // Stored in DB
  name: string; // Display name
  email: string;
  phone: string;
  address?: string;
  birthDate?: string;
  stamps: number;
  maxStamps: number;
  createdAt?: string; // Registration date from database
  history: StampEvent[];
}

export interface StampEvent {
  id: string;
  timestamp: number;
  type: 'add' | 'redeem' | 'voucher_earned' | 'voucher_redeemed';
  amount: number;
}

export interface StampCheckpoint {
  stampCount: number;
  reward: string;
}

export interface StampConfig {
  maxStamps: number;
  checkpoints: StampCheckpoint[];
}

export interface Voucher {
  id: string;
  userId: string;
  checkpointStampCount: number;
  rewardName: string;
  createdAt: string;
  expiresAt: string;
  redeemedAt?: string | null;
  status: 'active' | 'redeemed' | 'expired';
}

export enum AppRole {
  NONE = 'NONE',
  MEMBER = 'MEMBER',
  ADMIN = 'ADMIN'
}