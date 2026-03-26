import React, { useEffect, useState } from 'react';
import {
  X, Users, UserX, TrendingUp, RefreshCw, AlertTriangle,
  Phone, Award, Calendar, BarChart2, Activity, ArrowUpRight,
  Gift, Tag, Star
} from 'lucide-react';
import { fetchDashboardData } from '../services/storage';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const C = {
  green:    '#006B3F',
  greenMid: '#008f55',
  greenLt:  '#00c471',
  greenDim: '#003d24',
  amber:    '#f59e0b',
  amberLt:  '#fcd34d',
  red:      '#ef4444',
  redLt:    '#fca5a5',
  grid:     '#1a2e23',
  gridLt:   '#243b2e',
  text:     '#a3c4b0',
  textDim:  '#4d7260',
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AtRiskUser {
  id: string; name: string; phone: string; stamps: number;
  lastStampAt: string | null; daysSinceLastStamp: number | null;
}
interface BirthdayPerson {
  id: string; name: string; phone: string;
  birthDate: string; birthDay: number; birthMonth: number;
}
interface DashboardData {
  totalMembers: number; atRiskCount: number;
  newActiveCount: number; veteranActiveCount: number;
  weeklyGrowth: { label: string; count: number }[];
  cumulativeGrowth: { label: string; count: number }[];
  dailyGrowth: { date: string; count: number }[];
  atRiskUsers: AtRiskUser[];
  referralLeaderboard: { code: string; count: number }[];
  totalReferred: number;
  monthlyReferrals: { label: string; count: number }[];
  monthlyLeaderboards: Record<string, { code: string; count: number }[]>;
  birthdayToday: BirthdayPerson[];
  birthdayThisMonth: BirthdayPerson[];
}
interface DashboardViewProps { onClose: () => void; }

// ─── Combo Chart (Bars + Trend Line) ──────────────────────────────────────────
const ComboChart: React.FC<{
  weeklyGrowth: { label: string; count: number }[];
  selectedWeek: number | null;
  onSelectWeek: (i: number | null) => void;
}> = ({ weeklyGrowth, selectedWeek, onSelectWeek }) => {
  const W = 1000, H = 310;
  const PL = 52, PR = 64, PT = 38, PB = 44;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const cL = PL, cR = W - PR, cT = PT, cB = H - PB;

  const n = weeklyGrowth.length;
  const gap = 12;
  const barW = (cW - gap * (n - 1)) / n;

  const maxCount = Math.max(...weeklyGrowth.map(w => w.count), 1);

  // Bar helpers (bottom-up)
  const barX = (i: number) => cL + i * (barW + gap);
  const barCX = (i: number) => barX(i) + barW / 2;
  const barH = (c: number) => Math.max((c / maxCount) * cH, c > 0 ? 2 : 0);
  const barY = (c: number) => cB - barH(c);

  // Growth % (weeks 1–7 vs prev)
  const pcts = weeklyGrowth.slice(1).map((w, i) => {
    const prev = weeklyGrowth[i].count;
    if (prev === 0) return w.count > 0 ? 100 : 0;
    return ((w.count - prev) / prev) * 100;
  });
  const maxAbsPct = Math.max(...pcts.map(p => Math.abs(p)), 10);

  // Line helpers (secondary Y axis, right side)
  const zeroLineY = cT + (cH * 0.5); // 0% sits at middle of chart
  const lineY = (p: number) => zeroLineY - (p / maxAbsPct) * (cH * 0.45);
  const linePoints = pcts.map((p, i) => `${barCX(i + 1)},${lineY(p)}`).join(' ');

  // Y-axis grid for bar chart
  const gridLevels = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="barN" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.greenLt} stopOpacity="0.9" />
          <stop offset="100%" stopColor={C.greenDim} stopOpacity="1" />
        </linearGradient>
        <linearGradient id="barS" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor={C.green} />
        </linearGradient>
        <linearGradient id="areaUp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.amber} stopOpacity="0.35" />
          <stop offset="100%" stopColor={C.amber} stopOpacity="0.02" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Left Y-axis grid + labels */}
      {gridLevels.map(f => {
        const y = cB - f * cH;
        const v = Math.round(f * maxCount);
        return (
          <g key={f}>
            <line x1={cL} y1={y} x2={cR} y2={y}
              stroke={f === 0 ? C.gridLt : C.grid}
              strokeWidth={f === 0 ? 1 : 0.5} />
            <text x={cL - 6} y={y + 4} textAnchor="end"
              fill={C.textDim} fontSize="13" fontFamily="monospace">{v}</text>
          </g>
        );
      })}

      {/* Right Y axis labels for % trend */}
      {[maxAbsPct, 0, -maxAbsPct].map((p, idx) => (
        <text key={idx} x={cR + 6} y={lineY(p) + 5} textAnchor="start"
          fill={C.textDim} fontSize="13" fontFamily="monospace">
          {p > 0 ? '+' : ''}{Math.round(p)}%
        </text>
      ))}

      {/* 0% reference for trend */}
      <line x1={barCX(1)} y1={zeroLineY} x2={barCX(n - 1)} y2={zeroLineY}
        stroke={C.amber} strokeWidth="0.6" strokeDasharray="4,4" strokeOpacity="0.4" />

      {/* Bars (bottom-up) */}
      {weeklyGrowth.map((week, i) => {
        const x = barX(i);
        const bH = barH(week.count);
        const bY = barY(week.count);
        const isSel = selectedWeek === i;
        return (
          <g key={i} onClick={() => onSelectWeek(isSel ? null : i)} style={{ cursor: 'pointer' }}>
            {/* Hover column highlight */}
            <rect x={x} y={cT} width={barW} height={cH} rx="2"
              fill={isSel ? 'rgba(0,107,63,0.15)' : 'transparent'} />
            {/* Bar */}
            <rect x={x} y={bY} width={barW} height={bH} rx="3"
              fill={isSel ? 'url(#barS)' : 'url(#barN)'}
              style={{ transition: 'all 0.3s' }} />
            {/* Top shine on bar */}
            {bH > 8 && (
              <rect x={x + 2} y={bY + 1} width={barW - 4} height={3} rx="2"
                fill="white" fillOpacity="0.12" />
            )}
            {/* Count label */}
            {week.count > 0 && (
              <text x={x + barW / 2} y={bY - 8} textAnchor="middle"
                fill={isSel ? '#4ade80' : C.text} fontSize="14" fontWeight="800">
                {week.count}
              </text>
            )}
            {/* X label */}
            <text x={x + barW / 2} y={H - 8} textAnchor="middle"
              fill={isSel ? '#4ade80' : C.textDim}
              fontSize="13" fontWeight={isSel ? '800' : '600'}>
              {week.label}
            </text>
          </g>
        );
      })}

      {/* Trend area fill (above zero line only) */}
      {pcts.length > 1 && (
        <polygon
          points={`${barCX(1)},${zeroLineY} ${linePoints} ${barCX(n - 1)},${zeroLineY}`}
          fill="url(#areaUp)" />
      )}

      {/* Trend polyline */}
      {pcts.length > 1 && (
        <polyline points={linePoints} fill="none"
          stroke={C.amber} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          filter="url(#glow)" />
      )}

      {/* Trend dots + % labels (clickable, weeks 1-7) */}
      {pcts.map((p, i) => {
        const cx = barCX(i + 1);
        const cy = lineY(p);
        const isSel = selectedWeek === i + 1;
        const isPos = p >= 0;
        const labelY = isPos ? cy - 16 : cy + 20;
        return (
          <g key={i} onClick={() => onSelectWeek(isSel ? null : i + 1)}
            style={{ cursor: 'pointer' }}>
            <circle cx={cx} cy={cy} r={14} fill="transparent" />
            {isSel && (
              <circle cx={cx} cy={cy} r={9}
                fill={isPos ? C.greenLt : C.red} fillOpacity="0.2" />
            )}
            <circle cx={cx} cy={cy} r={isSel ? 5.5 : 4}
              fill="#0d1a12" stroke={isPos ? C.greenLt : C.red}
              strokeWidth={isSel ? 2.5 : 1.5} />
            {/* % label */}
            <text x={cx} y={labelY} textAnchor="middle"
              fill={isPos ? C.greenLt : C.redLt}
              fontSize="13" fontWeight="800">
              {isPos ? '+' : ''}{Math.round(p)}%
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${cL}, ${cT - 10})`}>
        <rect width={18} height={13} rx="3" fill={C.green} fillOpacity="0.85" />
        <text x={24} y={12} fill={C.textDim} fontSize="13" fontWeight="600">New members</text>
        <line x1={130} y1={7} x2={152} y2={7} stroke={C.amber} strokeWidth="3" strokeLinecap="round" />
        <circle cx={141} cy={7} r={5} fill={C.amber} />
        <text x={158} y={12} fill={C.textDim} fontSize="13" fontWeight="600">% Growth trend</text>
      </g>
    </svg>
  );
};

// ─── Monthly Bar Chart (Referrals) ─────────────────────────────────────────────
const MonthlyBarChart: React.FC<{
  data: { label: string; count: number }[];
  selectedMonth: string | null;
  onBarClick: (label: string | null) => void;
}> = ({ data: bars, selectedMonth, onBarClick }) => {
  const W = 1000, H = 260;
  const PL = 44, PR = 20, PT = 32, PB = 36;
  const cW = W - PL - PR, cH = H - PT - PB;
  const cL = PL, cB = H - PB, cT = PT;

  const n = bars.length;
  const gap = 10;
  const barW = (cW - gap * (n - 1)) / n;
  const maxVal = Math.max(...bars.map(b => b.count), 1);

  const barX  = (i: number) => cL + i * (barW + gap);
  const barH  = (v: number) => Math.max((v / maxVal) * cH, v > 0 ? 2 : 0);
  const barY  = (v: number) => cB - barH(v);
  const barCX = (i: number) => barX(i) + barW / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="mBarN" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.greenLt} stopOpacity="0.8" />
          <stop offset="100%" stopColor={C.greenDim} stopOpacity="1" />
        </linearGradient>
        <linearGradient id="mBarCur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor={C.green} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.5, 1].map(f => {
        const y = cB - f * cH;
        return (
          <g key={f}>
            <line x1={cL} y1={y} x2={W - PR} y2={y}
              stroke={f === 0 ? C.gridLt : C.grid} strokeWidth={f === 0 ? 1 : 0.5} />
            <text x={cL - 6} y={y + 4} textAnchor="end"
              fill={C.textDim} fontSize="12" fontFamily="monospace">
              {Math.round(f * maxVal)}
            </text>
          </g>
        );
      })}

      {/* Bars (bottom-up) */}
      {bars.map((b, i) => {
        const x = barX(i);
        const bH = barH(b.count);
        const bY = barY(b.count);
        const isCur = i === n - 1;
        const isSel = selectedMonth === b.label;
        return (
          <g key={i} onClick={() => onBarClick(isSel ? null : b.label)}
            style={{ cursor: 'pointer' }}>
            {/* Column hover bg */}
            <rect x={x} y={cT} width={barW} height={cH}
              fill={isSel ? 'rgba(0,196,113,0.1)' : 'transparent'} />
            {/* Bar */}
            <rect x={x} y={bY} width={barW} height={bH} rx="3"
              fill={isSel ? 'url(#mBarCur)' : isCur ? 'url(#mBarCur)' : 'url(#mBarN)'}
              opacity={selectedMonth && !isSel ? 0.4 : 1} />
            {bH > 8 && (
              <rect x={x + 2} y={bY + 1} width={barW - 4} height={3} rx="2"
                fill="white" fillOpacity="0.12" />
            )}
            {b.count > 0 && (
              <text x={barCX(i)} y={bY - 7} textAnchor="middle"
                fill={isSel ? '#4ade80' : isCur ? '#4ade80' : C.text}
                fontSize="13" fontWeight="800">
                {b.count}
              </text>
            )}
            {/* X label */}
            <text x={barCX(i)} y={H - 6} textAnchor="middle"
              fill={isSel ? '#4ade80' : isCur ? '#4ade80' : C.textDim}
              fontSize="12" fontWeight={isSel || isCur ? '800' : '600'}>
              {b.label}
            </text>
            {/* Selection indicator */}
            {isSel && (
              <text x={barCX(i)} y={H - 6 + 14} textAnchor="middle"
                fill="#4ade80" fontSize="11">▲</text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// ─── Daily Drill-Down ──────────────────────────────────────────────────────────
const DailyPanel: React.FC<{
  weekIndex: number;
  weekLabel: string;
  dailyGrowth: { date: string; count: number }[];
  onClose: () => void;
}> = ({ weekIndex, weekLabel, dailyGrowth, onClose }) => {
  const days = dailyGrowth.slice(weekIndex * 7, weekIndex * 7 + 7);
  const maxDay = Math.max(...days.map(d => d.count), 1);
  const total = days.reduce((s, d) => s + d.count, 0);

  return (
    <div className="mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2"
      style={{ borderColor: C.gridLt }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-black text-sm" style={{ color: '#e5f0e8' }}>Daily Breakdown</p>
          <p className="text-xs font-bold mt-0.5" style={{ color: C.textDim }}>
            Week of {weekLabel} · <span style={{ color: C.greenLt }}>{total}</span> new member{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={onClose}
          className="p-1.5 rounded-lg transition-all hover:bg-white/10"
          style={{ color: C.textDim }}>
          <X size={14} />
        </button>
      </div>
      <div className="flex items-end gap-3" style={{ height: 120 }}>
        {days.map((day, i) => {
          const pct = Math.max((day.count / maxDay) * 100, day.count > 0 ? 4 : 0);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-black" style={{ color: C.text, minHeight: 14 }}>
                {day.count > 0 ? day.count : ''}
              </span>
              {/* Bar track */}
              <div className="w-full relative rounded overflow-hidden" style={{ height: 80, background: C.gridLt }}>
                {/* Bar fill — absolutely positioned bottom-up */}
                <div className="absolute bottom-0 left-0 right-0 rounded"
                  style={{
                    height: `${pct}%`,
                    background: `linear-gradient(to top, ${C.greenDim}, ${C.greenMid})`
                  }} />
              </div>
              <span className="text-[9px] font-bold text-center leading-tight"
                style={{ color: C.textDim }}>{day.date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Cumulative Line Chart ─────────────────────────────────────────────────────
const CumulativeChart: React.FC<{
  cumulativeGrowth: { label: string; count: number }[];
}> = ({ cumulativeGrowth }) => {
  const n = cumulativeGrowth.length;
  const max = Math.max(...cumulativeGrowth.map(w => w.count), 1);
  const W = 1000, H = 160;
  const PL = 52, PR = 14, PT = 16, PB = 34;
  const cW = W - PL - PR, cH = H - PT - PB;
  const cL = PL, cR = W - PR, cT = PT, cB = H - PB;

  const px = (i: number) => cL + (i / (n - 1)) * cW;
  const py = (v: number) => cB - (v / max) * cH;
  const pts = cumulativeGrowth.map((w, i) => `${px(i)},${py(w.count)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="cumArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.green} stopOpacity="0.35" />
          <stop offset="100%" stopColor={C.green} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {[0, 0.5, 1].map(f => (
        <g key={f}>
          <line x1={cL} y1={cB - f * cH} x2={cR} y2={cB - f * cH}
            stroke={C.grid} strokeWidth="0.5" />
          <text x={cL - 6} y={cB - f * cH + 5} textAnchor="end"
            fill={C.textDim} fontSize="13" fontFamily="monospace">
            {Math.round(f * max)}
          </text>
        </g>
      ))}

      {/* Area */}
      {n > 1 && (
        <polygon points={`${cL},${cB} ${pts} ${cR},${cB}`} fill="url(#cumArea)" />
      )}

      {/* Line */}
      {n > 1 && (
        <polyline points={pts} fill="none"
          stroke={C.green} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Dots + value labels */}
      {cumulativeGrowth.map((w, i) => {
        const cx = px(i);
        const cy = py(w.count);
        const isNearTop = cy < cT + cH * 0.18;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="4.5"
              fill={C.green} stroke="#0d1a12" strokeWidth="2.5" />
            {w.count > 0 && (
              <text x={cx} y={isNearTop ? cy + 18 : cy - 9} textAnchor="middle"
                fill={C.text} fontSize="12" fontWeight="700">
                {w.count}
              </text>
            )}
          </g>
        );
      })}

      {/* X labels (every other) */}
      {cumulativeGrowth.filter((_, i) => i % 2 === 0).map((w, i) => (
        <text key={i} x={px(i * 2)} y={H - 4} textAnchor="middle"
          fill={C.textDim} fontSize="13" fontWeight="600">{w.label}</text>
      ))}
    </svg>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const DashboardView: React.FC<DashboardViewProps> = ({ onClose }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'retention' | 'referral' | 'birthday'>('overview');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedReferralMonth, setSelectedReferralMonth] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(''); setSelectedWeek(null);
    try {
      const result = await fetchDashboardData();
      if (result) setData(result);
      else setError('Failed to load dashboard data.');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const retentionRate = data
    ? Math.round(((data.totalMembers - data.atRiskCount) / Math.max(data.totalMembers, 1)) * 100)
    : 0;
  const totalNewThisMonth = data
    ? data.weeklyGrowth.slice(-4).reduce((s, w) => s + w.count, 0) : 0;

  const card = "rounded-2xl border p-5";
  const cardStyle = { background: 'rgba(13,26,18,0.7)', borderColor: C.gridLt };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-5xl lg:max-w-6xl flex flex-col sm:rounded-3xl overflow-hidden animate-in zoom-in-95"
        style={{ background: '#0a1610', border: `1px solid ${C.gridLt}`, boxShadow: `0 0 60px rgba(0,107,63,0.25)` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 shrink-0"
          style={{ borderBottom: `1px solid ${C.grid}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${C.green}, ${C.greenDim})`, boxShadow: `0 0 20px rgba(0,107,63,0.5)` }}>
              <BarChart2 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-black text-lg leading-none text-white">Analytics Dashboard</h2>
              <p className="text-xs font-bold mt-0.5 uppercase tracking-wider" style={{ color: C.text }}>Member Insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading}
              className="p-2.5 rounded-xl transition-all disabled:opacity-40 hover:bg-white/5"
              style={{ color: C.text }} title="Refresh">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose}
              className="p-2.5 rounded-xl transition-all hover:bg-white/5"
              style={{ color: C.text }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 px-6 pt-4 shrink-0">
          {([
            { id: 'overview',  label: '📊 Overview & Growth' },
            { id: 'retention', label: '🔄 Retention' },
            { id: 'referral',  label: '🏷️ Referral' },
            { id: 'birthday',  label: '🎂 Birthday' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={tab === t.id
                ? { background: C.green, color: '#fff', boxShadow: `0 4px 20px rgba(0,107,63,0.4)` }
                : { color: C.text }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
                style={{ borderColor: `${C.green} transparent ${C.green} ${C.green}` }} />
              <p className="font-bold animate-pulse" style={{ color: C.text }}>Loading dashboard...</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="flex items-center gap-3 p-4 rounded-2xl border"
              style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              <AlertTriangle size={18} />
              <p className="font-bold text-sm">{error}</p>
            </div>
          )}

          {/* ── OVERVIEW TAB ── */}
          {data && !loading && tab === 'overview' && (
            <>
              {/* KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Members', value: data.totalMembers, icon: <Users size={17} />, accent: C.green },
                  { label: 'New This Month', value: `+${totalNewThisMonth}`, icon: <ArrowUpRight size={17} />, accent: C.greenLt },
                  { label: 'At Risk', value: data.atRiskCount, icon: <UserX size={17} />, accent: '#f59e0b' },
                  { label: 'Retention', value: `${retentionRate}%`, icon: <Activity size={17} />, accent: '#10b981' },
                ].map(kpi => (
                  <div key={kpi.label} className={card} style={cardStyle}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3 text-white"
                      style={{ background: kpi.accent, boxShadow: `0 0 16px ${kpi.accent}55` }}>
                      {kpi.icon}
                    </div>
                    <p className="text-2xl font-black text-white">{kpi.value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: C.textDim }}>{kpi.label}</p>
                  </div>
                ))}
              </div>

              {/* ── Combo Chart Card ── */}
              <div className={card} style={cardStyle}>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 size={14} style={{ color: C.greenLt }} />
                  <p className="font-black text-sm text-white">Weekly Member Growth</p>
                  <span className="ml-auto text-[10px] font-bold" style={{ color: C.textDim }}>
                    Click bar or trend dot to drill down
                  </span>
                </div>

                <ComboChart
                  weeklyGrowth={data.weeklyGrowth}
                  selectedWeek={selectedWeek}
                  onSelectWeek={setSelectedWeek}
                />

                {/* Daily Panel */}
                {selectedWeek !== null && data.dailyGrowth && (
                  <DailyPanel
                    weekIndex={selectedWeek}
                    weekLabel={data.weeklyGrowth[selectedWeek]?.label ?? ''}
                    dailyGrowth={data.dailyGrowth}
                    onClose={() => setSelectedWeek(null)}
                  />
                )}
              </div>

              {/* ── Cumulative Growth ── */}
              <div className={card} style={cardStyle}>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} style={{ color: C.greenLt }} />
                  <p className="font-black text-sm text-white">Cumulative Member Total</p>
                  <span className="ml-auto text-[10px] font-bold" style={{ color: C.textDim }}>Running total · 8 weeks</span>
                </div>
                <CumulativeChart cumulativeGrowth={data.cumulativeGrowth} />
              </div>
            </>
          )}

          {/* ── REFERRAL TAB ── */}
          {data && !loading && tab === 'referral' && (
            <>
              {/* Monthly referral chart */}
              <div className={card} style={cardStyle}>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 size={14} style={{ color: C.greenLt }} />
                  <p className="font-black text-sm text-white">Monthly Referrals</p>
                  {selectedReferralMonth ? (
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-xs font-black px-2.5 py-1 rounded-full"
                        style={{ background: `${C.green}40`, color: C.greenLt, border: `1px solid ${C.green}66` }}>
                        Showing: {selectedReferralMonth}
                      </span>
                      <button onClick={() => setSelectedReferralMonth(null)}
                        className="text-xs font-bold hover:text-white transition-colors"
                        style={{ color: C.textDim }}>✕ Clear</button>
                    </span>
                  ) : (
                    <span className="ml-auto text-xs font-bold" style={{ color: C.textDim }}>Click bar to filter · Since Feb '26</span>
                  )}
                </div>
                <MonthlyBarChart
                  data={data.monthlyReferrals}
                  selectedMonth={selectedReferralMonth}
                  onBarClick={setSelectedReferralMonth}
                />
              </div>

              {/* Referral Leaderboard */}
              <div className={card} style={cardStyle}>
                <div className="flex items-center gap-2 mb-4">
                  <Tag size={15} style={{ color: C.greenLt }} />
                  <p className="font-black text-sm text-white">
                    {selectedReferralMonth ? `Referrals — ${selectedReferralMonth}` : 'Referral Performance (All-time)'}
                  </p>
                  <span className="ml-auto text-xs font-black px-2.5 py-1 rounded-full"
                    style={{ background: `${C.green}33`, color: C.greenLt, border: `1px solid ${C.green}66` }}>
                    {selectedReferralMonth
                      ? `${(data.monthlyLeaderboards[selectedReferralMonth] || []).reduce((s, i) => s + i.count, 0)} referred`
                      : `${data.totalReferred} referred`}
                  </span>
                </div>

                {(() => {
                  const board = selectedReferralMonth
                    ? (data.monthlyLeaderboards[selectedReferralMonth] || [])
                    : data.referralLeaderboard;
                  return board.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="font-bold text-sm" style={{ color: C.textDim }}>
                        {selectedReferralMonth ? `No referrals in ${selectedReferralMonth}` : 'No referral data yet.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {board.map((item, i) => {
                        const maxCount = board[0].count;
                        const pct = (item.count / maxCount) * 100;
                        const isTop = i === 0;
                        return (
                          <div key={item.code}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black"
                                  style={isTop
                                    ? { background: C.amber, color: '#000' }
                                    : { background: C.gridLt, color: C.text }}>
                                  {i + 1}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <Tag size={12} style={{ color: C.textDim }} />
                                  <span className="text-sm font-black" style={{ color: isTop ? C.greenLt : '#e5f0e8' }}>
                                    {item.code}
                                  </span>
                                </div>
                              </div>
                              <span className="text-sm font-black" style={{ color: isTop ? C.greenLt : C.text }}>
                                {item.count} member{item.count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: C.grid }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${pct}%`,
                                  background: isTop
                                    ? `linear-gradient(90deg, ${C.green}, ${C.greenLt})`
                                    : `linear-gradient(90deg, ${C.greenDim}, ${C.greenMid})`
                                }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* ── BIRTHDAY TAB ── */}
          {data && !loading && tab === 'birthday' && (
            <>
              {/* Birthday Today */}
              <div className={card} style={{ ...cardStyle, borderColor: data.birthdayToday.length > 0 ? `${C.amber}55` : C.gridLt }}>
                <div className="flex items-center gap-2 mb-4">
                  <Gift size={15} style={{ color: C.amber }} />
                  <p className="font-black text-sm text-white">🎂 Birthdays Today</p>
                  <span className="ml-auto text-xs font-black px-2.5 py-1 rounded-full"
                    style={{
                      background: data.birthdayToday.length > 0 ? 'rgba(245,158,11,0.2)' : C.gridLt,
                      color: data.birthdayToday.length > 0 ? C.amber : C.textDim,
                      border: `1px solid ${data.birthdayToday.length > 0 ? 'rgba(245,158,11,0.4)' : C.gridLt}`
                    }}>
                    {data.birthdayToday.length}
                  </span>
                </div>

                {data.birthdayToday.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-2xl mb-2">📅</p>
                    <p className="font-bold text-sm" style={{ color: C.textDim }}>No birthdays today</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.birthdayToday.map(p => (
                      <div key={p.id} className="flex items-center gap-4 p-4 rounded-2xl"
                        style={{ background: 'rgba(245,158,11,0.1)', border: `1px solid rgba(245,158,11,0.25)` }}>
                        <div className="text-3xl animate-bounce">🎂</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Phone size={11} style={{ color: C.textDim }} />
                            <p className="text-xs truncate" style={{ color: C.textDim }}>{p.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl"
                          style={{ background: 'rgba(245,158,11,0.2)', border: `1px solid rgba(245,158,11,0.3)` }}>
                          <Star size={12} style={{ color: C.amber }} />
                          <span className="text-xs font-black" style={{ color: C.amber }}>Today!</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Birthday This Month */}
              <div className={card} style={cardStyle}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={15} style={{ color: C.greenLt }} />
                  <p className="font-black text-sm text-white">Birthdays This Month</p>
                  <span className="ml-auto text-xs font-black px-2.5 py-1 rounded-full"
                    style={{ background: `${C.green}33`, color: C.greenLt, border: `1px solid ${C.green}66` }}>
                    {data.birthdayThisMonth.length}
                  </span>
                </div>

                {data.birthdayThisMonth.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-2xl mb-2">📅</p>
                    <p className="font-bold text-sm" style={{ color: C.textDim }}>No birthdays this month</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: C.grid }}>
                    {data.birthdayThisMonth.map(p => {
                      const isToday = data.birthdayToday.some(t => t.id === p.id);
                      return (
                        <div key={p.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                            style={{
                              background: isToday ? C.amber : C.greenDim,
                              color: isToday ? '#000' : C.greenLt
                            }}>
                            {isToday ? '🎂' : p.birthDay}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-white truncate">{p.name}</p>
                              {isToday && (
                                <span className="text-xs font-black px-2 py-0.5 rounded-full shrink-0"
                                  style={{ background: 'rgba(245,158,11,0.2)', color: C.amber }}>Today</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Phone size={11} style={{ color: C.textDim }} />
                              <p className="text-xs truncate" style={{ color: C.textDim }}>{p.phone}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold shrink-0" style={{ color: C.textDim }}>
                            {p.birthDate}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── RETENTION TAB ── */}
          {data && !loading && tab === 'retention' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {/* Active Members — with breakdown */}
                <div className={card} style={{ ...cardStyle, borderColor: `${C.green}55` }}>
                  <p className="text-2xl font-black" style={{ color: C.greenLt }}>{data.totalMembers - data.atRiskCount}</p>
                  <p className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: C.textDim }}>Active Members</p>
                  <p className="text-xs mt-1" style={{ color: C.textDim }}>Visited in last 30 days</p>
                  {/* Breakdown */}
                  <div className="mt-3 pt-3 space-y-2" style={{ borderTop: `1px solid ${C.gridLt}` }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: C.greenLt }} />
                        <span className="text-[11px] font-bold" style={{ color: C.text }}>New (&lt;1 bulan)</span>
                      </div>
                      <span className="text-sm font-black" style={{ color: C.greenLt }}>{data.newActiveCount ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#60a5fa' }} />
                        <span className="text-[11px] font-bold" style={{ color: C.text }}>Loyal (&gt;1 bulan)</span>
                      </div>
                      <span className="text-sm font-black" style={{ color: '#60a5fa' }}>{data.veteranActiveCount ?? 0}</span>
                    </div>
                  </div>
                </div>
                <div className={card} style={{ ...cardStyle, borderColor: 'rgba(245,158,11,0.35)' }}>
                  <p className="text-2xl font-black" style={{ color: C.amber }}>{data.atRiskCount}</p>
                  <p className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: C.textDim }}>At-Risk</p>
                  <p className="text-xs mt-1" style={{ color: C.textDim }}>No visit in 30+ days</p>
                </div>
              </div>

              {/* Retention rate */}
              <div className={card} style={cardStyle}>
                <div className="flex justify-between items-center mb-3">
                  <p className="font-black text-sm text-white">Retention Rate</p>
                  <span className="font-black text-lg"
                    style={{ color: retentionRate >= 70 ? C.greenLt : retentionRate >= 40 ? C.amber : '#ef4444' }}>
                    {retentionRate}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: C.grid }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${retentionRate}%`,
                      background: retentionRate >= 70
                        ? `linear-gradient(90deg, ${C.green}, ${C.greenLt})`
                        : retentionRate >= 40
                        ? `linear-gradient(90deg, #d97706, #f59e0b)`
                        : `linear-gradient(90deg, #991b1b, #ef4444)`
                    }} />
                </div>
                <p className="text-xs font-bold mt-2" style={{ color: C.textDim }}>
                  {retentionRate >= 70 ? '✅ Excellent retention'
                    : retentionRate >= 40 ? '⚠️ Moderate – consider re-engagement'
                    : '🚨 Low – re-engagement needed'}
                </p>
              </div>

              {/* At-risk list */}
              <div className="rounded-2xl overflow-hidden border" style={{ ...cardStyle, padding: 0 }}>
                <div className="flex items-center gap-2 px-5 py-4"
                  style={{ borderBottom: `1px solid ${C.gridLt}` }}>
                  <AlertTriangle size={14} style={{ color: C.amber }} />
                  <p className="font-black text-sm text-white">At-Risk Customers</p>
                  <span className="ml-auto text-xs font-black px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(245,158,11,0.15)', color: C.amber, border: `1px solid rgba(245,158,11,0.3)` }}>
                    {data.atRiskCount}
                  </span>
                </div>
                {data.atRiskUsers.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="font-black text-lg" style={{ color: C.greenLt }}>🎉 All members are active!</p>
                    <p className="text-sm mt-1" style={{ color: C.textDim }}>No at-risk customers right now.</p>
                  </div>
                ) : (
                  <div className="divide-y max-h-80 overflow-y-auto" style={{ borderColor: C.grid }}>
                    {data.atRiskUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                          style={{ background: C.greenDim }}>
                          {u.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-white truncate">{u.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Phone size={11} style={{ color: C.textDim }} />
                            <p className="text-xs truncate" style={{ color: C.textDim }}>{u.phone}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 justify-end">
                            <Award size={11} style={{ color: C.textDim }} />
                            <span className="text-xs font-bold" style={{ color: C.text }}>{u.stamps} stamps</span>
                          </div>
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            <Calendar size={11} style={{ color: C.amber }} />
                            <span className="text-xs font-bold" style={{ color: C.amber }}>
                              {u.daysSinceLastStamp !== null ? `${u.daysSinceLastStamp}d ago` : 'Never'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
