import React, { useEffect, useState, useRef } from 'react';
import {
  X, Users, UserX, TrendingUp, RefreshCw, AlertTriangle,
  Phone, Award, Calendar, BarChart2, Activity, ArrowUpRight,
  Gift, Tag, Star, Ticket, MessageCircle, Download, ChevronDown, FileSpreadsheet
} from 'lucide-react';
import { fetchDashboardData, fetchVoucherStats, generateMembersCSV } from '../services/storage';
import { applyWATemplate } from './WATemplateConfig';
import { getAvailableWeeks, downloadWeeklyExcel, type WeekOption } from '../services/weeklyExcelExport';

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
      <div className="flex items-end gap-3" style={{ height: 132 }}>
        {days.map((day, i) => {
          const pct = Math.max((day.count / maxDay) * 100, day.count > 0 ? 4 : 0);
          // Parse "Mar 19" → short day name using current year
          const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          const monthMap: Record<string,number> = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
          const parts = day.date.split(' ');
          const parsedDate = parts.length === 2 ? new Date(new Date().getFullYear(), monthMap[parts[0]] ?? 0, parseInt(parts[1])) : null;
          const dayLabel = parsedDate ? dayNames[parsedDate.getDay()] : '';
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
              <span className="text-[9px] font-bold text-center leading-none"
                style={{ color: C.textDim }}>
                {dayLabel && <span className="block" style={{ color: C.text }}>{dayLabel}</span>}
                {day.date}
              </span>
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

// ─── WhatsApp helper ──────────────────────────────────────────────────────────
const openWhatsApp = (phone: string | number | null | undefined, message: string) => {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const num = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank');
};




// ─── Main Component ────────────────────────────────────────────────────────────
export const DashboardView: React.FC<DashboardViewProps> = ({ onClose }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'retention' | 'referral' | 'birthday' | 'vouchers'>('overview');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedReferralMonth, setSelectedReferralMonth] = useState<string | null>(null);
  const [retentionMode, setRetentionMode] = useState<'weekly' | 'monthly'>('monthly');
  const [voucherStats, setVoucherStats] = useState<any>(null);
  const [downloadingMembers, setDownloadingMembers] = useState(false);
  const [showWeeklyDropdown, setShowWeeklyDropdown] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const weeklyDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (weeklyDropdownRef.current && !weeklyDropdownRef.current.contains(e.target as Node)) {
        setShowWeeklyDropdown(false);
      }
    };
    if (showWeeklyDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWeeklyDropdown]);

  const handleWeeklyDownload = async (week: WeekOption) => {
    if (!week.available || downloadingExcel) return;
    setDownloadingExcel(true);
    setShowWeeklyDropdown(false);
    try {
      await downloadWeeklyExcel(week.monday, week.sunday);
    } catch (err) {
      console.error('Failed to generate weekly report:', err);
    } finally {
      setDownloadingExcel(false);
    }
  };

  const load = async () => {
    setLoading(true); setError(''); setSelectedWeek(null);
    try {
      const [result, vStats] = await Promise.all([
        fetchDashboardData(),
        fetchVoucherStats()
      ]);
      if (result) setData(result);
      else setError('Failed to load dashboard data.');
      if (vStats) setVoucherStats(vStats);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleDownloadMembers = async () => {
    setDownloadingMembers(true);
    try {
      const csv = await generateMembersCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `member_list_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingMembers(false);
    }
  };

  /**
   * Retention metrics derived from available backend data:
   *
   * Monthly (<30 days): exact backend figure
   *   active = totalMembers - atRiskCount  (visited in last 30 days)
   *
   * Weekly (<7 days): best approximation from available fields
   *   active = newActiveCount (members who joined < 1 month ago AND are still active)
   *          + veteranActiveCount (loyal members, visited < 30 days)
   *   at-risk = everyone else (atRiskCount + members visited 7-29 days ago)
   *   Note: members visited 7-29 days ago cannot be isolated without per-user data,
   *   so weekly uses newActiveCount as the "recently engaged" proxy.
   */
  const computedRetention = (() => {
    if (!data) return { periodActive: 0, periodAtRisk: 0, rate: 0 };
    if (retentionMode === 'monthly') {
      const active = data.totalMembers - data.atRiskCount;
      const rate = Math.round((active / Math.max(data.totalMembers, 1)) * 100);
      return { periodActive: active, periodAtRisk: data.atRiskCount, rate };
    } else {
      // Weekly: newActiveCount = members who joined < 1 month AND visited < 30 days
      // These are the most recently engaged members — best weekly proxy from available data
      const weeklyActive = data.newActiveCount ?? 0;
      const periodAtRisk = data.totalMembers - weeklyActive;
      const rate = Math.round((weeklyActive / Math.max(data.totalMembers, 1)) * 100);
      return { periodActive: weeklyActive, periodAtRisk, rate };
    }
  })();

  const retentionRate = computedRetention.rate;
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
            {/* Weekly Report Download */}
            <div className="relative" ref={weeklyDropdownRef}>
              <button
                onClick={() => setShowWeeklyDropdown(!showWeeklyDropdown)}
                disabled={downloadingExcel}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all hover:bg-white/10 active:scale-95 disabled:opacity-50"
                style={{ background: `${C.green}33`, color: C.greenLt, border: `1px solid ${C.green}55` }}
                title="Download Weekly Excel Report">
                {downloadingExcel ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={14} />
                )}
                <span className="hidden sm:inline">{downloadingExcel ? 'Generating...' : 'Weekly Report'}</span>
                <ChevronDown size={12} className={`transition-transform ${showWeeklyDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {showWeeklyDropdown && (
                <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto rounded-2xl border z-50"
                  style={{
                    background: 'rgba(10,22,16,0.98)',
                    borderColor: C.gridLt,
                    boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(0,107,63,0.15)`,
                    backdropFilter: 'blur(20px)',
                  }}>
                  {/* Dropdown header */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: C.grid }}>
                    <p className="text-xs font-black text-white">📥 Download Weekly Report</p>
                    <p className="text-[10px] mt-0.5" style={{ color: C.textDim }}>Select a week period (Mon – Sun)</p>
                  </div>

                  {/* Week list grouped by month */}
                  <div className="py-1">
                    {(() => {
                      const weeks = getAvailableWeeks(12);
                      let lastMonth = '';
                      return weeks.map((week, i) => {
                        const showMonthHeader = week.monthGroup !== lastMonth;
                        lastMonth = week.monthGroup;
                        return (
                          <React.Fragment key={i}>
                            {showMonthHeader && (
                              <div className="px-4 pt-3 pb-1">
                                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.amber }}>
                                  {week.monthGroup}
                                </p>
                              </div>
                            )}
                            <button
                              onClick={() => handleWeeklyDownload(week)}
                              disabled={!week.available}
                              className="w-full text-left px-4 py-2.5 transition-all flex items-center gap-3 group"
                              style={{
                                opacity: week.available ? 1 : 0.4,
                                cursor: week.available ? 'pointer' : 'not-allowed',
                              }}
                              onMouseEnter={(e) => { if (week.available) (e.currentTarget.style.background = 'rgba(0,107,63,0.15)'); }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: week.available ? `${C.green}33` : C.grid }}>
                                <Download size={12} style={{ color: week.available ? C.greenLt : C.textDim }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate" style={{ color: week.available ? '#e5f0e8' : C.textDim }}>
                                  {week.label}
                                </p>
                                {!week.available && (
                                  <p className="text-[9px] mt-0.5" style={{ color: C.amber }}>Available after 10 PM Sunday</p>
                                )}
                              </div>
                              {week.available && i === 0 && (
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full shrink-0"
                                  style={{ background: `${C.greenLt}20`, color: C.greenLt, border: `1px solid ${C.greenLt}30` }}>
                                  Latest
                                </span>
                              )}
                              {week.available && i > 0 && i === 0 && null}
                            </button>
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

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
            { id: 'vouchers',  label: '🎟️ Vouchers' },
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
                  <div className="ml-auto flex items-center gap-2">
                    <span className="hidden sm:inline text-[10px] font-bold" style={{ color: C.textDim }}>
                      Click bar or trend dot to drill down
                    </span>
                    <button
                      onClick={handleDownloadMembers}
                      disabled={downloadingMembers}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 hover:bg-white/10 active:scale-95"
                      style={{ background: `${C.green}33`, color: C.greenLt, border: `1px solid ${C.green}66` }}
                      title="Download detail member list (CSV) with last check-in / sign up date">
                      <Download size={12} className={downloadingMembers ? 'animate-bounce' : ''} />
                      {downloadingMembers ? 'Preparing...' : 'Download'}
                    </button>
                  </div>
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
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                            style={{ background: 'rgba(245,158,11,0.2)', border: `1px solid rgba(245,158,11,0.3)` }}>
                            <Star size={12} style={{ color: C.amber }} />
                            <span className="text-xs font-black" style={{ color: C.amber }}>Today!</span>
                          </div>
                          <button
                            onClick={() => openWhatsApp(p.phone, applyWATemplate('birthdayToday', { nama: p.name }))}
                            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                            style={{ background: '#25D36622', border: '1px solid #25D36644' }}
                            title="Send WhatsApp greeting">
                            <MessageCircle size={15} style={{ color: '#25D366' }} />
                          </button>
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
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold" style={{ color: C.textDim }}>
                              {p.birthDate}
                            </span>
                            <button
                              onClick={() => openWhatsApp(p.phone, applyWATemplate(
                                isToday ? 'birthdayToday' : 'birthdayMonth',
                                { nama: p.name }
                              ))}  
                              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                              style={{ background: '#25D36622', border: '1px solid #25D36644' }}
                              title="Send WhatsApp greeting">
                              <MessageCircle size={14} style={{ color: '#25D366' }} />
                            </button>
                          </div>
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
              {/* ── Retention Period Selector ── */}
              <div className={card} style={{ ...cardStyle, padding: '12px 20px' }}>
                <div className="flex items-center gap-3">
                  <Calendar size={14} style={{ color: C.greenLt }} />
                  <span className="text-xs font-black uppercase tracking-wider" style={{ color: C.text }}>View by</span>
                  {/* Toggle pill */}
                  <div className="flex items-center ml-auto rounded-xl overflow-hidden"
                    style={{ background: C.grid, border: `1px solid ${C.gridLt}` }}>
                    {(['weekly', 'monthly'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setRetentionMode(mode)}
                        className="px-4 py-1.5 text-xs font-black transition-all capitalize"
                        style={retentionMode === mode
                          ? { background: C.green, color: '#fff', boxShadow: `0 0 14px ${C.green}55` }
                          : { background: 'transparent', color: C.textDim }
                        }
                      >
                        {mode === 'weekly' ? '📅 Weekly' : '🗓️ Monthly'}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: C.textDim }}>
                    {retentionMode === 'weekly' ? 'Visited in the last 7 days' : 'Visited in the last 30 days'}
                  </span>
                </div>
              </div>

              {/* KPI row — 2 balanced cards */}
              {(() => {
                const activeTotal = computedRetention.periodActive;
                const atRiskTotal = computedRetention.periodAtRisk;
                const newCount = data.newActiveCount ?? 0;
                const loyalCount = data.veteranActiveCount ?? 0;
                const newPct = activeTotal > 0 ? Math.round((newCount / activeTotal) * 100) : 0;
                const loyalPct = activeTotal > 0 ? 100 - newPct : 0;
                const activeSubtitle = retentionMode === 'weekly'
                  ? 'New members (joined <1 month)'
                  : 'Visited in last 30 days';
                const atRiskSubtitle = retentionMode === 'weekly'
                  ? 'Not newly joined this month'
                  : 'No visit in 30+ days';
                return (
                  <div className="grid grid-cols-2 gap-3">

                    {/* ── Active Members card with breakdown ── */}
                    <div className={card} style={{ ...cardStyle, borderColor: `${C.green}55` }}>
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-3xl font-black leading-none" style={{ color: C.greenLt }}>{activeTotal}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider mt-1.5" style={{ color: C.textDim }}>Active Members</p>
                          <p className="text-[10px] mt-0.5" style={{ color: C.textDim }}>{activeSubtitle}</p>
                        </div>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${C.green}55` }}>
                          <Users size={15} style={{ color: C.greenLt }} />
                        </div>
                      </div>

                      {/* Stacked proportion bar */}
                      <div className="h-2 rounded-full overflow-hidden flex gap-px" style={{ background: C.grid }}>
                        <div className="h-full transition-all duration-700 rounded-l-full"
                          style={{ width: `${newPct}%`, background: `linear-gradient(90deg, ${C.green}, ${C.greenLt})` }} />
                        <div className="h-full transition-all duration-700 rounded-r-full"
                          style={{ width: `${loyalPct}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
                      </div>

                      {/* Sub-stats */}
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {/* New */}
                        <div className="rounded-xl px-3 py-2.5" style={{ background: `${C.greenLt}12`, border: `1px solid ${C.greenLt}25` }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.greenLt }} />
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textDim }}>New</span>
                          </div>
                          <p className="text-xl font-black leading-none" style={{ color: C.greenLt }}>{newCount}</p>
                          <p className="text-[10px] mt-1" style={{ color: C.textDim }}>&lt; 1 month old</p>
                          <p className="text-[10px] font-black mt-0.5" style={{ color: C.greenLt }}>{newPct}%</p>
                        </div>
                        {/* Loyal */}
                        <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#60a5fa' }} />
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textDim }}>Loyal</span>
                          </div>
                          <p className="text-xl font-black leading-none" style={{ color: '#60a5fa' }}>{loyalCount}</p>
                          <p className="text-[10px] mt-1" style={{ color: C.textDim }}>&gt; 1 month old</p>
                          <p className="text-[10px] font-black mt-0.5" style={{ color: '#60a5fa' }}>{loyalPct}%</p>
                        </div>
                      </div>
                    </div>

                    {/* ── At-Risk card ── */}
                    <div className={card} style={{ ...cardStyle, borderColor: 'rgba(245,158,11,0.35)' }}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-3xl font-black leading-none" style={{ color: C.amber }}>{atRiskTotal}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider mt-1.5" style={{ color: C.textDim }}>At-Risk</p>
                          <p className="text-[10px] mt-0.5" style={{ color: C.textDim }}>{atRiskSubtitle}</p>
                        </div>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(245,158,11,0.15)' }}>
                          <UserX size={15} style={{ color: C.amber }} />
                        </div>
                      </div>
                      {/* Risk proportion bar */}
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: C.grid }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${data.totalMembers > 0 ? Math.round((atRiskTotal / data.totalMembers) * 100) : 0}%`,
                            background: 'linear-gradient(90deg, #d97706, #f59e0b)'
                          }} />
                      </div>
                      <p className="text-[10px] font-bold mt-1.5" style={{ color: C.textDim }}>
                        {data.totalMembers > 0 ? Math.round((atRiskTotal / data.totalMembers) * 100) : 0}% of total members
                      </p>
                    </div>

                  </div>
                );
              })()}

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
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
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
                          <button
                            onClick={() => openWhatsApp(u.phone, applyWATemplate('atRisk', { nama: u.name }))}
                            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                            style={{ background: '#25D36622', border: '1px solid #25D36644' }}
                            title="Send WhatsApp re-engagement">
                            <MessageCircle size={14} style={{ color: '#25D366' }} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          {/* ── VOUCHERS TAB ── */}
          {!loading && tab === 'vouchers' && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: 'ACTIVE',
                    value: voucherStats?.active ?? 0,
                    icon: <Gift size={18} />,
                    iconBg: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    glow: 'rgba(124,58,237,0.5)',
                    border: 'rgba(124,58,237,0.4)'
                  },
                  {
                    label: 'REDEEMED',
                    value: voucherStats?.redeemed ?? 0,
                    icon: <Award size={18} />,
                    iconBg: 'linear-gradient(135deg, #d97706, #f59e0b)',
                    glow: 'rgba(245,158,11,0.4)',
                    border: 'rgba(245,158,11,0.35)'
                  },
                  {
                    label: 'EXPIRED',
                    value: voucherStats?.expired ?? 0,
                    icon: <X size={18} />,
                    iconBg: 'linear-gradient(135deg, #dc2626, #ef4444)',
                    glow: 'rgba(239,68,68,0.45)',
                    border: 'rgba(239,68,68,0.35)'
                  },
                ].map(kpi => (
                  <div key={kpi.label} className={card} style={{ ...cardStyle, borderColor: kpi.border }}>
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 text-white"
                      style={{ background: kpi.iconBg, boxShadow: `0 0 18px ${kpi.glow}` }}>
                      {kpi.icon}
                    </div>
                    <p className="text-4xl font-black text-white leading-none">{kpi.value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-2" style={{ color: C.textDim }}>{kpi.label}</p>
                  </div>
                ))}
              </div>

              {/* Voucher Distribution */}
              {!voucherStats ? (
                <div className={card} style={cardStyle}>
                  <div className="py-10 text-center">
                    <Ticket size={32} className="mx-auto mb-3" style={{ color: C.textDim }} />
                    <p className="font-bold text-sm" style={{ color: C.textDim }}>No voucher data available yet.</p>
                    <p className="text-xs mt-1" style={{ color: C.textDim }}>Vouchers will appear here once members earn them.</p>
                  </div>
                </div>
              ) : (
                <div className={card} style={cardStyle}>
                  <div className="flex items-center gap-2 mb-5">
                    <Tag size={15} style={{ color: '#a78bfa' }} />
                    <p className="font-black text-sm text-white">Voucher Distribution</p>
                  </div>

                  {(!voucherStats.distribution || voucherStats.distribution.length === 0) ? (
                    <div className="py-8 text-center">
                      <p className="font-bold text-sm" style={{ color: C.textDim }}>No vouchers issued yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {voucherStats.distribution.map((item: any, i: number) => {
                        const total = Math.max(item.total, 1);
                        const activePct  = (item.active   / total) * 100;
                        const redeemedPct = (item.redeemed / total) * 100;
                        return (
                          <div key={item.name}>
                            {/* Row header */}
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                                  style={{ background: C.gridLt, color: '#a78bfa' }}>
                                  {i + 1}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <Ticket size={12} style={{ color: C.textDim }} />
                                  <span className="text-sm font-black" style={{ color: '#e5f0e8' }}>{item.name}</span>
                                </div>
                              </div>
                              <span className="text-sm font-black" style={{ color: '#a78bfa' }}>{item.total} total</span>
                            </div>

                            {/* Segmented progress bar */}
                            <div className="h-2 rounded-full overflow-hidden flex" style={{ background: C.grid }}>
                              {/* Active segment — purple */}
                              <div className="h-full transition-all duration-700"
                                style={{
                                  width: `${activePct}%`,
                                  background: 'linear-gradient(90deg, #7c3aed, #a78bfa)'
                                }} />
                              {/* Redeemed segment — amber */}
                              <div className="h-full transition-all duration-700"
                                style={{
                                  width: `${redeemedPct}%`,
                                  background: 'linear-gradient(90deg, #d97706, #f59e0b)'
                                }} />
                              {/* Expired remainder stays as gray track */}
                            </div>

                            {/* Sub-labels */}
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px] font-bold" style={{ color: C.textDim }}>
                                {item.active} Active
                              </span>
                              <span className="text-[10px] font-bold" style={{ color: C.textDim }}>
                                {item.redeemed} Redeemed
                              </span>
                              <span className="text-[10px] font-bold" style={{ color: C.textDim }}>
                                {item.expired} Expired
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Nearly Expiring Vouchers — customer detail list */}
              {voucherStats && (
                <div className="rounded-2xl overflow-hidden border" style={{ ...cardStyle, padding: 0, borderColor: 'rgba(239,68,68,0.35)' }}>
                  <div className="flex items-center gap-2 px-5 py-4"
                    style={{ borderBottom: `1px solid ${C.gridLt}` }}>
                    <AlertTriangle size={14} style={{ color: '#f87171' }} />
                    <p className="font-black text-sm text-white">Vouchers Expiring in 7 Days</p>
                    <span className="ml-auto text-xs font-black px-2.5 py-1 rounded-full"
                      style={{
                        background: (voucherStats.nearlyExpiring?.length ?? 0) > 0
                          ? 'rgba(239,68,68,0.15)' : C.gridLt,
                        color: (voucherStats.nearlyExpiring?.length ?? 0) > 0 ? '#f87171' : C.textDim,
                        border: `1px solid ${(voucherStats.nearlyExpiring?.length ?? 0) > 0 ? 'rgba(239,68,68,0.4)' : C.gridLt}`
                      }}>
                      {voucherStats.nearlyExpiring?.length ?? 0}
                    </span>
                  </div>

                  {(!voucherStats.nearlyExpiring || voucherStats.nearlyExpiring.length === 0) ? (
                    <div className="py-10 text-center">
                      <p className="text-2xl mb-2">✅</p>
                      <p className="font-bold text-sm" style={{ color: C.textDim }}>No vouchers expiring within 7 days</p>
                      <p className="text-xs mt-1" style={{ color: C.textDim }}>All active vouchers have more than a week left.</p>
                    </div>
                  ) : (
                    <div className="divide-y max-h-96 overflow-y-auto" style={{ borderColor: C.grid }}>
                      {voucherStats.nearlyExpiring.map((entry: any) => {
                        const urgentColor = entry.daysLeft <= 2
                          ? '#f87171'   // red — very urgent
                          : entry.daysLeft <= 5
                          ? '#f59e0b'   // amber — moderate
                          : C.greenLt;  // green — still okay
                        const urgentBg = entry.daysLeft <= 2
                          ? 'rgba(239,68,68,0.12)'
                          : entry.daysLeft <= 5
                          ? 'rgba(245,158,11,0.12)'
                          : `${C.green}18`;
                        const urgentBorder = entry.daysLeft <= 2
                          ? 'rgba(239,68,68,0.3)'
                          : entry.daysLeft <= 5
                          ? 'rgba(245,158,11,0.3)'
                          : `${C.green}40`;

                        return (
                          <div key={entry.voucherId}
                            className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                              style={{ background: C.greenDim }}>
                              {entry.userName.charAt(0)}
                            </div>

                            {/* Customer info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-white truncate">{entry.userName}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Phone size={11} style={{ color: C.textDim }} />
                                <p className="text-xs truncate" style={{ color: C.textDim }}>{entry.userPhone}</p>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Ticket size={11} style={{ color: C.textDim }} />
                                <p className="text-xs truncate" style={{ color: C.textDim }}>{entry.rewardName}</p>
                              </div>
                            </div>

                            {/* Urgency badge + WhatsApp */}
                            <div className="shrink-0 flex flex-col items-end gap-1.5">
                              <div className="flex items-center gap-2">
                                <div className="px-2.5 py-1 rounded-xl flex items-center gap-1.5"
                                  style={{ background: urgentBg, border: `1px solid ${urgentBorder}` }}>
                                  <AlertTriangle size={11} style={{ color: urgentColor }} />
                                  <span className="text-xs font-black" style={{ color: urgentColor }}>
                                    {entry.daysLeft === 0 ? 'Today!' : `${entry.daysLeft}d left`}
                                  </span>
                                </div>
                                <button
                                  onClick={() => openWhatsApp(entry.userPhone, applyWATemplate('nearlyExpiring', {
                                    nama: entry.userName,
                                    reward: entry.rewardName,
                                    hari: entry.daysLeft === 0 ? 'hari ini' : String(entry.daysLeft),
                                    tanggal: new Date(entry.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }),
                                  }))}
                                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                                  style={{ background: '#25D36622', border: '1px solid #25D36644' }}
                                  title="Send WhatsApp voucher reminder">
                                  <MessageCircle size={14} style={{ color: '#25D366' }} />
                                </button>
                              </div>
                              <span className="text-[10px] font-bold" style={{ color: C.textDim }}>
                                {new Date(entry.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};
