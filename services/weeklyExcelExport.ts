import ExcelJS from 'exceljs';
import { fetchDashboardData, fetchVoucherStats, getAllUsersList, fetchAllTransactions } from './storage';
import type { User } from '../types';

// ─── Week Computation Helpers ──────────────────────────────────────────────────

const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getSunday = (monday: Date): Date => {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

const fmtShort = (d: Date): string =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const fmtISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const fmtDisplay = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Colors ────────────────────────────────────────────────────────────────────

const XL = {
  darkGreen: '006B3F',
  green: '008F55',
  lightGreen: '00C471',
  brightGreen: '4ADE80',
  darkBg: '0D1A12',
  sectionBg: '0F211A',
  headerBg: '142D1F',
  gridBg: '1A2E23',
  amber: 'F59E0B',
  red: 'EF4444',
  white: 'FFFFFF',
  offWhite: 'E5F0E8',
  lightText: 'A3C4B0',
  dimText: '4D7260',
  dimBar: '1A2E23',
  purple: '7C3AED',
};

const fill = (color: string): ExcelJS.Fill => ({
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color },
});

const font = (opts: { bold?: boolean; size?: number; color?: string; italic?: boolean }): Partial<ExcelJS.Font> => ({
  name: 'Calibri',
  bold: opts.bold ?? false,
  size: opts.size ?? 11,
  italic: opts.italic ?? false,
  color: { argb: 'FF' + (opts.color ?? XL.white) },
});

const thinBorder = (color: string): Partial<ExcelJS.Borders> => ({
  bottom: { style: 'thin', color: { argb: 'FF' + color } },
});

// ─── Bar Visualization ─────────────────────────────────────────────────────────

const makeBar = (value: number, maxValue: number, maxBlocks: number = 20): ExcelJS.CellRichTextValue => {
  if (maxValue <= 0 || value <= 0) return { richText: [{ text: '' }] };
  const filled = Math.max(1, Math.round((value / maxValue) * maxBlocks));
  const empty = maxBlocks - filled;
  return {
    richText: [
      { text: '█'.repeat(filled), font: { name: 'Calibri', color: { argb: 'FF' + XL.lightGreen } } },
      ...(empty > 0 ? [{ text: '░'.repeat(empty), font: { name: 'Calibri', color: { argb: 'FF' + XL.dimBar } } }] : []),
    ],
  };
};

const makeBarAmber = (value: number, maxValue: number, maxBlocks: number = 20): ExcelJS.CellRichTextValue => {
  if (maxValue <= 0 || value <= 0) return { richText: [{ text: '' }] };
  const filled = Math.max(1, Math.round((value / maxValue) * maxBlocks));
  const empty = maxBlocks - filled;
  return {
    richText: [
      { text: '█'.repeat(filled), font: { name: 'Calibri', color: { argb: 'FF' + XL.amber } } },
      ...(empty > 0 ? [{ text: '░'.repeat(empty), font: { name: 'Calibri', color: { argb: 'FF' + XL.dimBar } } }] : []),
    ],
  };
};

const makeBarPurple = (value: number, maxValue: number, maxBlocks: number = 20): ExcelJS.CellRichTextValue => {
  if (maxValue <= 0 || value <= 0) return { richText: [{ text: '' }] };
  const filled = Math.max(1, Math.round((value / maxValue) * maxBlocks));
  const empty = maxBlocks - filled;
  return {
    richText: [
      { text: '█'.repeat(filled), font: { name: 'Calibri', color: { argb: 'FF' + XL.purple } } },
      ...(empty > 0 ? [{ text: '░'.repeat(empty), font: { name: 'Calibri', color: { argb: 'FF' + XL.dimBar } } }] : []),
    ],
  };
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface WeekOption {
  monday: Date;
  sunday: Date;
  label: string;
  available: boolean;
  monthGroup: string;
}

export const getAvailableWeeks = (count: number = 12): WeekOption[] => {
  const now = new Date();
  const currentMonday = getMonday(now);
  const weeks: WeekOption[] = [];
  for (let i = 0; i < count; i++) {
    const monday = new Date(currentMonday);
    monday.setDate(monday.getDate() - i * 7);
    const sunday = getSunday(monday);
    let available = true;
    if (i === 0) {
      const sundayCutoff = new Date(sunday);
      sundayCutoff.setHours(22, 0, 0, 0);
      available = now >= sundayCutoff;
    }
    weeks.push({
      monday, sunday,
      label: `${fmtShort(monday)} – ${fmtShort(sunday)}`,
      available,
      monthGroup: monday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    });
  }
  return weeks;
};

const isInWeek = (dateStr: string | number | null | undefined, monday: Date, sunday: Date): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d >= monday && d <= sunday;
};

// ─── Styled Data Sheet Helper ──────────────────────────────────────────────────

const addDataSheet = (
  wb: ExcelJS.Workbook,
  name: string,
  columns: { header: string; key: string; width: number; numFmt?: string }[],
  rows: Record<string, any>[],
) => {
  const ws = wb.addWorksheet(name, {
    views: [{ showGridLines: false }],
  });
  ws.columns = columns;

  // Header row
  const headerRow = ws.getRow(1);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = font({ bold: true, size: 11, color: XL.white }) as ExcelJS.Font;
    cell.fill = fill(XL.darkGreen);
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = thinBorder(XL.green) as ExcelJS.Borders;
  });
  headerRow.height = 28;

  // Data rows
  rows.forEach((rowData, ri) => {
    const row = ws.getRow(ri + 2);
    columns.forEach((col, ci) => {
      const cell = row.getCell(ci + 1);
      let val = rowData[col.key] ?? '';
      // Convert to number if numFmt is specified and value is numeric
      if (col.numFmt && val !== '' && val != null) {
        const num = Number(String(val).replace(/\D/g, ''));
        if (!isNaN(num) && num > 0) {
          val = num;
          cell.numFmt = col.numFmt;
        }
      }
      cell.value = val;
      cell.font = font({ size: 10, color: XL.offWhite }) as ExcelJS.Font;
      cell.fill = fill(ri % 2 === 0 ? XL.darkBg : XL.sectionBg);
      cell.alignment = { vertical: 'middle' };
    });
    row.height = 22;
  });

  // Auto filter
  if (rows.length > 0) {
    ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}${rows.length + 1}` };
  }
};

// ─── Main Export ───────────────────────────────────────────────────────────────

export const downloadWeeklyExcel = async (monday: Date, sunday: Date): Promise<void> => {
  // ── Fetch all data ──
  const [dashboardData, voucherStats, allUsers, allTransactions] = await Promise.all([
    fetchDashboardData(), fetchVoucherStats(), getAllUsersList(), fetchAllTransactions(),
  ]);

  // ── Build activity map ──
  const lastActivityMap: Record<string, { date: number; type: string }> = {};
  allTransactions.forEach((tx: any) => {
    const uid = String(tx.userId);
    const ts = Number(tx.timestamp);
    if (!lastActivityMap[uid] || ts > lastActivityMap[uid].date) {
      lastActivityMap[uid] = { date: ts, type: tx.type === 'add' ? 'Check-in' : tx.type };
    }
  });

  // ── Filter: New Users ──
  const newUsers = allUsers.filter((u: User) => isInWeek(u.createdAt, monday, sunday));

  // ── Filter: Transactions this week ──
  const weekTransactions = allTransactions.filter((tx: any) => isInWeek(tx.timestamp, monday, sunday));

  // ── Retention data ──
  const retentionData = allUsers.map((u: User) => {
    const last = lastActivityMap[String(u.id)];
    const lastDate = last ? new Date(last.date) : null;
    const daysSince = lastDate ? Math.floor((sunday.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const status = daysSince === null ? 'Never Active'
      : daysSince <= 7 ? 'Active (7d)'
      : daysSince <= 30 ? 'Active (30d)'
      : 'At Risk';
    return { name: u.name || '', phone: u.phone || '', stamps: u.stamps || 0, totalStamps: u.totalStamps ?? u.stamps ?? 0, lastCheckIn: lastDate ? fmtDisplay(lastDate) : 'Never', daysSinceLastVisit: daysSince ?? 'N/A', status };
  });

  // ── Referrals ──
  const referralUsers = newUsers.filter((u: any) => u.adminReferral || u.referralCode);
  const referralMap: Record<string, { code: string; members: string[] }> = {};
  referralUsers.forEach((u: any) => {
    const code = u.adminReferral || u.referralCode || '';
    if (!referralMap[code]) referralMap[code] = { code, members: [] };
    referralMap[code].members.push(u.name || u.phone || '');
  });

  // ── Birthdays ──
  const birthdayData = allUsers.filter((u: User) => {
    if (!u.birthDate) return false;
    const bd = new Date(u.birthDate);
    if (isNaN(bd.getTime())) return false;
    const bMonth = bd.getMonth(), bDay = bd.getDate();
    for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() === bMonth && d.getDate() === bDay) return true;
    }
    return false;
  }).map((u: User) => {
    const bd = new Date(u.birthDate!);
    const bMonth = bd.getMonth(), bDay = bd.getDate();
    let dayOfWeek = '';
    for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() === bMonth && d.getDate() === bDay) {
        dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' });
        break;
      }
    }
    return { name: u.name || '', phone: u.phone || '', birthDate: u.birthDate || '', dayOfWeek };
  });

  // ── Computed metrics ──
  const active7d = retentionData.filter(r => r.status === 'Active (7d)').length;
  const active30d = retentionData.filter(r => r.status === 'Active (30d)').length;
  const atRiskCount = retentionData.filter(r => r.status === 'At Risk').length;
  const neverActive = retentionData.filter(r => r.status === 'Never Active').length;
  const retentionRate = allUsers.length > 0 ? Math.round(((active7d + active30d) / allUsers.length) * 100) : 0;
  const weekStamps = weekTransactions.filter((tx: any) => tx.type === 'add').length;
  const weeklyGrowth = dashboardData?.weeklyGrowth ?? [];

  // ══════════════════════════════════════════════════════════════════════════════
  // CREATE WORKBOOK
  // ══════════════════════════════════════════════════════════════════════════════

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CRM Analytics';
  wb.created = new Date();

  // ── SUMMARY SHEET ──────────────────────────────────────────────────────────

  const ws = wb.addWorksheet('📊 Summary', {
    views: [{ showGridLines: false }],
    properties: { defaultColWidth: 14, tabColor: { argb: 'FF006B3F' } },
  });

  ws.columns = [
    { width: 24 }, // A - Labels
    { width: 14 }, // B - Values
    { width: 32 }, // C - Visual bar
    { width: 14 }, // D - Extra info
  ];

  let row = 1;

  // ── Title Banner ──
  ws.mergeCells(`A${row}:D${row}`);
  const titleCell = ws.getCell(`A${row}`);
  titleCell.value = '📊  WEEKLY ANALYTICS REPORT';
  titleCell.font = font({ bold: true, size: 16, color: XL.white }) as ExcelJS.Font;
  titleCell.fill = fill(XL.darkGreen);
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 36;
  row++;

  ws.mergeCells(`A${row}:D${row}`);
  const periodCell = ws.getCell(`A${row}`);
  periodCell.value = `${fmtShort(monday)} – ${fmtShort(sunday)}, ${monday.getFullYear()}  •  Generated: ${new Date().toLocaleString()}`;
  periodCell.font = font({ size: 10, color: XL.lightText, italic: true }) as ExcelJS.Font;
  periodCell.fill = fill(XL.darkGreen);
  periodCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 24;
  row++;

  // Spacer
  ws.getRow(row).height = 8;
  row++;

  // ── KPI SECTION ──
  const kpiHeader = ws.getRow(row);
  ws.mergeCells(`A${row}:D${row}`);
  const kpiHeaderCell = ws.getCell(`A${row}`);
  kpiHeaderCell.value = '🔑  KEY PERFORMANCE INDICATORS';
  kpiHeaderCell.font = font({ bold: true, size: 12, color: XL.lightGreen }) as ExcelJS.Font;
  kpiHeaderCell.fill = fill(XL.headerBg);
  kpiHeaderCell.border = thinBorder(XL.green) as ExcelJS.Borders;
  kpiHeader.height = 30;
  row++;

  const kpiMaxVal = Math.max(allUsers.length, newUsers.length, active7d + active30d, atRiskCount, 1);

  const kpis = [
    { label: 'Total Members', value: allUsers.length, bar: makeBar(allUsers.length, kpiMaxVal), extra: '' },
    { label: 'New This Week', value: newUsers.length, bar: makeBar(newUsers.length, kpiMaxVal), extra: `${weekStamps} check-ins` },
    { label: 'Active Members', value: active7d + active30d, bar: makeBar(active7d + active30d, kpiMaxVal), extra: `${retentionRate}% retention` },
    { label: 'At Risk', value: atRiskCount, bar: makeBarAmber(atRiskCount, kpiMaxVal), extra: `${neverActive} never active` },
  ];

  kpis.forEach((kpi, i) => {
    const r = ws.getRow(row);
    r.height = 26;
    const cellA = ws.getCell(`A${row}`);
    cellA.value = kpi.label;
    cellA.font = font({ bold: true, size: 11, color: XL.offWhite }) as ExcelJS.Font;
    cellA.fill = fill(i % 2 === 0 ? XL.darkBg : XL.sectionBg);

    const cellB = ws.getCell(`B${row}`);
    cellB.value = kpi.value;
    cellB.font = font({ bold: true, size: 14, color: XL.white }) as ExcelJS.Font;
    cellB.fill = fill(i % 2 === 0 ? XL.darkBg : XL.sectionBg);
    cellB.alignment = { horizontal: 'center', vertical: 'middle' };

    const cellC = ws.getCell(`C${row}`);
    cellC.value = kpi.bar;
    cellC.fill = fill(i % 2 === 0 ? XL.darkBg : XL.sectionBg);

    const cellD = ws.getCell(`D${row}`);
    cellD.value = kpi.extra;
    cellD.font = font({ size: 9, color: XL.dimText, italic: true }) as ExcelJS.Font;
    cellD.fill = fill(i % 2 === 0 ? XL.darkBg : XL.sectionBg);
    row++;
  });

  // Spacer
  ws.getRow(row).height = 12;
  row++;

  // ── WEEKLY NEW USERS TREND ──
  ws.mergeCells(`A${row}:D${row}`);
  const trendHeader = ws.getCell(`A${row}`);
  trendHeader.value = '📈  WEEKLY NEW USERS TREND';
  trendHeader.font = font({ bold: true, size: 12, color: XL.lightGreen }) as ExcelJS.Font;
  trendHeader.fill = fill(XL.headerBg);
  trendHeader.border = thinBorder(XL.green) as ExcelJS.Borders;
  ws.getRow(row).height = 30;
  row++;

  // Column headers
  ['Week', 'New Users', 'Trend', 'Growth'].forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = font({ bold: true, size: 9, color: XL.lightText }) as ExcelJS.Font;
    cell.fill = fill(XL.gridBg);
  });
  ws.getRow(row).height = 22;
  row++;

  const maxWeekly = Math.max(...weeklyGrowth.map((w: any) => w.count), 1);
  weeklyGrowth.forEach((week: any, i: number) => {
    const r = ws.getRow(row);
    r.height = 24;
    const bg = i % 2 === 0 ? XL.darkBg : XL.sectionBg;

    const cellA = ws.getCell(`A${row}`);
    cellA.value = week.label;
    cellA.font = font({ size: 10, color: XL.offWhite }) as ExcelJS.Font;
    cellA.fill = fill(bg);

    const cellB = ws.getCell(`B${row}`);
    cellB.value = week.count;
    cellB.font = font({ bold: true, size: 12, color: XL.white }) as ExcelJS.Font;
    cellB.fill = fill(bg);
    cellB.alignment = { horizontal: 'center' };

    const cellC = ws.getCell(`C${row}`);
    cellC.value = makeBar(week.count, maxWeekly, 25);
    cellC.fill = fill(bg);

    // Growth %
    const cellD = ws.getCell(`D${row}`);
    if (i > 0) {
      const prev = weeklyGrowth[i - 1].count;
      if (prev > 0) {
        const pct = Math.round(((week.count - prev) / prev) * 100);
        cellD.value = `${pct >= 0 ? '+' : ''}${pct}%`;
        cellD.font = font({ bold: true, size: 10, color: pct >= 0 ? XL.brightGreen : XL.red }) as ExcelJS.Font;
      } else {
        cellD.value = week.count > 0 ? '+∞' : '0%';
        cellD.font = font({ size: 10, color: XL.dimText }) as ExcelJS.Font;
      }
    } else {
      cellD.value = '—';
      cellD.font = font({ size: 10, color: XL.dimText }) as ExcelJS.Font;
    }
    cellD.fill = fill(bg);
    cellD.alignment = { horizontal: 'center' };
    row++;
  });

  // Spacer
  ws.getRow(row).height = 12;
  row++;

  // ── RETENTION BREAKDOWN ──
  ws.mergeCells(`A${row}:D${row}`);
  const retHeader = ws.getCell(`A${row}`);
  retHeader.value = '🔄  RETENTION BREAKDOWN';
  retHeader.font = font({ bold: true, size: 12, color: XL.lightGreen }) as ExcelJS.Font;
  retHeader.fill = fill(XL.headerBg);
  retHeader.border = thinBorder(XL.green) as ExcelJS.Borders;
  ws.getRow(row).height = 30;
  row++;

  const retMax = Math.max(active7d, active30d, atRiskCount, neverActive, 1);
  const retRows = [
    { label: 'Active (7 days)', val: active7d, bar: makeBar(active7d, retMax), pct: `${allUsers.length > 0 ? Math.round((active7d / allUsers.length) * 100) : 0}%` },
    { label: 'Active (30 days)', val: active30d, bar: makeBar(active30d, retMax), pct: `${allUsers.length > 0 ? Math.round((active30d / allUsers.length) * 100) : 0}%` },
    { label: 'At Risk (30+ days)', val: atRiskCount, bar: makeBarAmber(atRiskCount, retMax), pct: `${allUsers.length > 0 ? Math.round((atRiskCount / allUsers.length) * 100) : 0}%` },
    { label: 'Never Active', val: neverActive, bar: makeBarAmber(neverActive, retMax), pct: `${allUsers.length > 0 ? Math.round((neverActive / allUsers.length) * 100) : 0}%` },
  ];

  retRows.forEach((item, i) => {
    const r = ws.getRow(row);
    r.height = 24;
    const bg = i % 2 === 0 ? XL.darkBg : XL.sectionBg;
    ws.getCell(`A${row}`).value = item.label;
    ws.getCell(`A${row}`).font = font({ size: 10, color: XL.offWhite }) as ExcelJS.Font;
    ws.getCell(`A${row}`).fill = fill(bg);
    ws.getCell(`B${row}`).value = item.val;
    ws.getCell(`B${row}`).font = font({ bold: true, size: 12, color: XL.white }) as ExcelJS.Font;
    ws.getCell(`B${row}`).fill = fill(bg);
    ws.getCell(`B${row}`).alignment = { horizontal: 'center' };
    ws.getCell(`C${row}`).value = item.bar;
    ws.getCell(`C${row}`).fill = fill(bg);
    ws.getCell(`D${row}`).value = item.pct;
    ws.getCell(`D${row}`).font = font({ bold: true, size: 10, color: XL.lightText }) as ExcelJS.Font;
    ws.getCell(`D${row}`).fill = fill(bg);
    ws.getCell(`D${row}`).alignment = { horizontal: 'center' };
    row++;
  });

  // Spacer
  ws.getRow(row).height = 12;
  row++;

  // ── REFERRALS & BIRTHDAYS ──
  ws.mergeCells(`A${row}:D${row}`);
  const refHeader = ws.getCell(`A${row}`);
  refHeader.value = '🏷️  REFERRALS & BIRTHDAYS';
  refHeader.font = font({ bold: true, size: 12, color: XL.lightGreen }) as ExcelJS.Font;
  refHeader.fill = fill(XL.headerBg);
  refHeader.border = thinBorder(XL.green) as ExcelJS.Borders;
  ws.getRow(row).height = 30;
  row++;

  const refBdMax = Math.max(referralUsers.length, Object.keys(referralMap).length, birthdayData.length, 1);
  const refBdRows = [
    { label: 'New Referrals This Week', val: referralUsers.length, bar: makeBar(referralUsers.length, refBdMax) },
    { label: 'Unique Referral Codes', val: Object.keys(referralMap).length, bar: makeBar(Object.keys(referralMap).length, refBdMax) },
    { label: 'Birthdays This Week', val: birthdayData.length, bar: makeBarAmber(birthdayData.length, refBdMax) },
  ];

  refBdRows.forEach((item, i) => {
    const r = ws.getRow(row);
    r.height = 24;
    const bg = i % 2 === 0 ? XL.darkBg : XL.sectionBg;
    ws.getCell(`A${row}`).value = item.label;
    ws.getCell(`A${row}`).font = font({ size: 10, color: XL.offWhite }) as ExcelJS.Font;
    ws.getCell(`A${row}`).fill = fill(bg);
    ws.getCell(`B${row}`).value = item.val;
    ws.getCell(`B${row}`).font = font({ bold: true, size: 12, color: XL.white }) as ExcelJS.Font;
    ws.getCell(`B${row}`).fill = fill(bg);
    ws.getCell(`B${row}`).alignment = { horizontal: 'center' };
    ws.getCell(`C${row}`).value = item.bar;
    ws.getCell(`C${row}`).fill = fill(bg);
    ws.getCell(`D${row}`).value = '';
    ws.getCell(`D${row}`).fill = fill(bg);
    row++;
  });

  // Spacer
  ws.getRow(row).height = 12;
  row++;

  // ── VOUCHER STATUS ──
  ws.mergeCells(`A${row}:D${row}`);
  const voucherHeader = ws.getCell(`A${row}`);
  voucherHeader.value = '🎟️  VOUCHER STATUS';
  voucherHeader.font = font({ bold: true, size: 12, color: XL.lightGreen }) as ExcelJS.Font;
  voucherHeader.fill = fill(XL.headerBg);
  voucherHeader.border = thinBorder(XL.green) as ExcelJS.Borders;
  ws.getRow(row).height = 30;
  row++;

  const vActive = voucherStats?.active ?? 0;
  const vRedeemed = voucherStats?.redeemed ?? 0;
  const vExpired = voucherStats?.expired ?? 0;
  const vExpiring = voucherStats?.nearlyExpiring?.length ?? 0;
  const vMax = Math.max(vActive, vRedeemed, vExpired, vExpiring, 1);

  const vRows = [
    { label: 'Active Vouchers', val: vActive, bar: makeBarPurple(vActive, vMax) },
    { label: 'Redeemed', val: vRedeemed, bar: makeBarAmber(vRedeemed, vMax) },
    { label: 'Expired', val: vExpired, bar: makeBarAmber(vExpired, vMax) },
    { label: 'Expiring in 7 Days', val: vExpiring, bar: makeBarAmber(vExpiring, vMax) },
  ];

  vRows.forEach((item, i) => {
    const r = ws.getRow(row);
    r.height = 24;
    const bg = i % 2 === 0 ? XL.darkBg : XL.sectionBg;
    ws.getCell(`A${row}`).value = item.label;
    ws.getCell(`A${row}`).font = font({ size: 10, color: XL.offWhite }) as ExcelJS.Font;
    ws.getCell(`A${row}`).fill = fill(bg);
    ws.getCell(`B${row}`).value = item.val;
    ws.getCell(`B${row}`).font = font({ bold: true, size: 12, color: XL.white }) as ExcelJS.Font;
    ws.getCell(`B${row}`).fill = fill(bg);
    ws.getCell(`B${row}`).alignment = { horizontal: 'center' };
    ws.getCell(`C${row}`).value = item.bar;
    ws.getCell(`C${row}`).fill = fill(bg);
    ws.getCell(`D${row}`).value = '';
    ws.getCell(`D${row}`).fill = fill(bg);
    row++;
  });

  // ── DATA SHEETS ────────────────────────────────────────────────────────────

  // Sheet 2: New Users
  addDataSheet(wb, '👤 New Users', [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Phone', key: 'phone', width: 18, numFmt: '0' },
    { header: 'Address', key: 'address', width: 30 },
    { header: 'Birth Date', key: 'birthDate', width: 14 },
    { header: 'Sign Up Date', key: 'signUpDate', width: 16 },
    { header: 'Referral Code', key: 'referralCode', width: 16 },
    { header: 'Last Activity', key: 'lastActivity', width: 16 },
    { header: 'Activity Type', key: 'activityType', width: 14 },
  ], newUsers.length > 0 ? newUsers.map((u: User) => {
    const last = lastActivityMap[String(u.id)];
    const lastDate = last ? new Date(last.date) : null;
    return {
      name: u.name || '', phone: u.phone || '', address: u.address || '',
      birthDate: u.birthDate || '', signUpDate: fmtDisplay(u.createdAt),
      referralCode: (u as any).adminReferral || (u as any).referralCode || '',
      lastActivity: lastDate ? fmtDisplay(lastDate) : fmtDisplay(u.createdAt),
      activityType: last ? (last.type === 'add' ? 'Check-in' : last.type) : 'Sign Up',
    };
  }) : [{ name: 'No new users this week' }]);

  // Sheet 3: Retention
  addDataSheet(wb, '🔄 Retention', [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Phone', key: 'phone', width: 18, numFmt: '0' },
    { header: 'Current Stamps', key: 'stamps', width: 14 },
    { header: 'Total Stamps', key: 'totalStamps', width: 14 },
    { header: 'Last Check-in', key: 'lastCheckIn', width: 16 },
    { header: 'Days Since Visit', key: 'daysSince', width: 16 },
    { header: 'Status', key: 'status', width: 16 },
  ], retentionData.map(r => ({
    name: r.name, phone: r.phone, stamps: r.stamps, totalStamps: r.totalStamps,
    lastCheckIn: r.lastCheckIn, daysSince: r.daysSinceLastVisit, status: r.status,
  })));

  // Sheet 4: Referrals
  const referralRows = Object.values(referralMap).map(r => ({
    code: r.code, count: r.members.length, members: r.members.join(', '),
  }));
  addDataSheet(wb, '🏷️ Referrals', [
    { header: 'Referral Code', key: 'code', width: 20 },
    { header: 'Referred Count', key: 'count', width: 16 },
    { header: 'Referred Members', key: 'members', width: 50 },
  ], referralRows.length > 0 ? referralRows : [{ code: 'No referrals this week' }]);

  // Sheet 5: Birthdays
  addDataSheet(wb, '🎂 Birthdays', [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Phone', key: 'phone', width: 18, numFmt: '0' },
    { header: 'Birth Date', key: 'birthDate', width: 14 },
    { header: 'Birthday Falls On', key: 'dayOfWeek', width: 18 },
  ], birthdayData.length > 0 ? birthdayData : [{ name: 'No birthdays this week' }]);

  // Sheet 6: Vouchers
  const voucherDistRows = (voucherStats?.distribution || []).map((item: any) => ({
    name: item.name || '', total: item.total || 0, active: item.active || 0,
    redeemed: item.redeemed || 0, expired: item.expired || 0,
    holderName: '', holderPhone: '', daysLeft: '', expiryDate: '',
  }));
  const nearlyExpRows = (voucherStats?.nearlyExpiring || []).map((e: any) => ({
    name: e.rewardName || '', total: '', active: '', redeemed: '', expired: '',
    holderName: e.userName || '', holderPhone: e.userPhone || '',
    daysLeft: e.daysLeft, expiryDate: fmtDisplay(e.expiresAt),
  }));
  addDataSheet(wb, '🎟️ Vouchers', [
    { header: 'Voucher Name', key: 'name', width: 25 },
    { header: 'Total', key: 'total', width: 10 },
    { header: 'Active', key: 'active', width: 10 },
    { header: 'Redeemed', key: 'redeemed', width: 12 },
    { header: 'Expired', key: 'expired', width: 10 },
    { header: 'Holder Name', key: 'holderName', width: 22 },
    { header: 'Holder Phone', key: 'holderPhone', width: 18, numFmt: '0' },
    { header: 'Days Left', key: 'daysLeft', width: 10 },
    { header: 'Expiry Date', key: 'expiryDate', width: 14 },
  ], [...voucherDistRows, ...nearlyExpRows].length > 0 ? [...voucherDistRows, ...nearlyExpRows] : [{ name: 'No voucher data' }]);

  // ── DOWNLOAD ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Weekly_Report_${fmtISO(monday)}_to_${fmtISO(sunday)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
