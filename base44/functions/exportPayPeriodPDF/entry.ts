import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

// ── Constants ──
const M = 18;
const PW = 210 - M * 2;
const PAGE_H = 297;
const COLORS = {
  primary: [23, 162, 140], muted: [140, 150, 160], dark: [30, 35, 40],
  light: [245, 247, 250], border: [220, 225, 230],
};

// ── Helpers ──
function round2(n) { return Math.round(n * 100) / 100; }
function fmtCurrency(n) {
  const abs = Math.abs(n || 0);
  return (n < 0 ? '-' : '') + '$' + abs.toLocaleString('en-CA', { minimumFractionDigits: 2 });
}
function safe(str) {
  if (!str) return '';
  return String(str).replace(/\u2013|\u2014/g, '-').replace(/\u00b7/g, '.').replace(/\u2019|\u2018/g, "'").replace(/[^\x00-\xFF]/g, '?');
}

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.replace('.', ':').split(':').map(Number);
  return h + (m || 0) / 60;
}
function formatTime(decimal) {
  let h = Math.floor(decimal) % 24;
  return `${String(h).padStart(2, '0')}:${String(Math.round((decimal - Math.floor(decimal)) * 60)).padStart(2, '0')}`;
}
function hoursInRange(sStart, sEnd, rStart, rEnd) {
  if (sStart >= sEnd) sEnd += 24;
  if (rStart >= rEnd) rEnd += 24;
  const oStart = Math.max(sStart, rStart), oEnd = Math.min(sEnd, rEnd);
  return oStart < oEnd ? oEnd - oStart : 0;
}
function shiftSpan(s, e) { const start = parseTime(s); let end = parseTime(e); if (end <= start) end += 24; return end - start; }

// ── Stat holidays (inline for backend) ──
const SUPER_STATS_2026 = ['2026-01-01','2026-04-03','2026-04-06','2026-05-18','2026-07-01','2026-09-07','2026-10-12','2026-11-11','2026-12-25','2026-12-26'];
const STATS_2026 = ['2026-02-16','2026-08-03'];
const ALL_STATS_2026 = [...SUPER_STATS_2026, ...STATS_2026];
const SUPER_STATS_2027 = ['2027-01-01','2027-03-26','2027-03-29','2027-05-24','2027-07-01','2027-09-06','2027-10-11','2027-11-11','2027-12-25','2027-12-27'];
const STATS_2027 = ['2027-02-15','2027-08-02'];
const ALL_STATS_2027 = [...SUPER_STATS_2027, ...STATS_2027];
function getStatType(dateStr) {
  for (const d of SUPER_STATS_2026) if (dateStr === d) return 'super_stat';
  for (const d of SUPER_STATS_2027) if (dateStr === d) return 'super_stat';
  for (const d of STATS_2026) if (dateStr === d) return 'stat';
  for (const d of STATS_2027) if (dateStr === d) return 'stat';
  return null;
}

// ── Per-shift segment multiplier ──
function getSegMultiplier(shiftType, segmentDate) {
  const baseMap = { day_off: 2.0, unpaid_vacation: 0, unpaid_sick: 0 };
  const base = baseMap[shiftType] ?? 1.0;
  if (base === 0) return 0;
  const statType = getStatType(segmentDate);
  if (shiftType === 'day_off') return statType ? 3.0 : 2.0;
  const straight = ['casual','regular','isn','vacation','paid_vacation','sick','paid_sick','special_leave','pdo_pst','other_leave'];
  if (straight.includes(shiftType)) {
    if (statType === 'super_stat') return 2.5;
    if (statType === 'stat') return 2.0;
    return 1.0;
  }
  return base;
}

// ── Split overnight shift into per-date segments ──
function splitOvernight(shift) {
  const startH = parseTime(shift.start_time);
  let endH = parseTime(shift.end_time);
  const unpaidBreak = shift.unpaid_break || 0;
  if (endH > startH) {
    const hours = shift.paid_hours || (endH - startH - unpaidBreak);
    return [{ date: shift.date, hours: round2(hours) }];
  }
  endH += 24;
  const beforeClock = 24 - startH;
  const afterClock = endH - 24;
  let beforePaid, afterPaid;
  if (unpaidBreak > 0 && (beforeClock + afterClock) >= 5) {
    const breakStart = startH + 5, breakEnd = breakStart + unpaidBreak;
    beforePaid = round2(beforeClock - Math.max(0, Math.min(breakEnd, 24) - breakStart));
    afterPaid = round2(afterClock - Math.max(0, breakEnd - Math.max(breakStart, 24)));
  } else {
    const ph = shift.paid_hours || (beforeClock + afterClock);
    beforePaid = round2((beforeClock / (beforeClock + afterClock)) * ph);
    afterPaid = round2((afterClock / (beforeClock + afterClock)) * ph);
  }
  const next = new Date(shift.date + 'T12:00:00'); next.setDate(next.getDate() + 1);
  return [{ date: shift.date, hours: beforePaid }, { date: next.toISOString().slice(0, 10), hours: afterPaid }];
}

// ── Per-shift premium calculation ──
function shiftPremiums(shift, rates) {
  const paidHours = shift.paid_hours || 0;
  const isStraight = ['casual','regular','isn','vacation','paid_vacation','sick','paid_sick','special_leave','pdo_pst','other_leave'].includes(shift.shift_type);
  const span = shiftSpan(shift.start_time, shift.end_time);
  const extended = span >= 10;
  const start = parseTime(shift.start_time);
  const end = parseTime(shift.end_time);

  let eveH = 0, nightH = 0;
  if (extended) {
    eveH = hoursInRange(start, end, 15.5, 23.5);
    nightH = hoursInRange(start, end, 23.5, 31.5);
  } else {
    const eveTotal = hoursInRange(start, end, 15.5, 23.5);
    const nightTotal = hoursInRange(start, end, 23.5, 31.5);
    if (eveTotal > nightTotal && eveTotal > span / 2) eveH = paidHours;
    else if (nightTotal > eveTotal && nightTotal > span / 2) nightH = paidHours;
  }

  // Weekend hours
  const dayOfWeek = new Date(shift.date + 'T12:00:00').getUTCDay();
  let wkndH = 0;
  const cap = (h) => Math.min(h, paidHours);
  if (dayOfWeek === 5) wkndH = hoursInRange(start, end, 23, 47);
  else if (dayOfWeek === 6) wkndH = hoursInRange(start, end, 0, 47);
  else if (dayOfWeek === 0) wkndH = hoursInRange(start, end, 0, 23);

  // Super shift hours
  let superH = 0;
  if (dayOfWeek === 5) superH = hoursInRange(start, end, 23.5, 31.5);
  else if (dayOfWeek === 6) superH = hoursInRange(start, end, 23.5, 31.5);

  eveH = cap(eveH); nightH = cap(nightH); wkndH = cap(wkndH); superH = cap(superH);

  const overrides = shift.premium_overrides || {};
  return {
    evening: overrides.evening != null ? overrides.evening : round2(eveH * (rates.evening || 0)),
    night:   overrides.night != null   ? overrides.night   : round2(nightH * (rates.night || 0)),
    weekend: overrides.weekend != null ? overrides.weekend : round2(wkndH * (rates.weekend || 0)),
    super_shift: overrides.super_shift != null ? overrides.super_shift : round2(superH * (rates.super_shift || 0)),
    regular_premium: overrides.regular_premium != null ? overrides.regular_premium
      : (isStraight ? round2(paidHours * (rates.regular_premium || 0)) : 0),
    short_notice: overrides.short_notice != null ? overrides.short_notice
      : (shift.short_notice ? round2(paidHours * (rates.short_notice || 0)) : 0),
    responsibility: overrides.responsibility != null ? overrides.responsibility
      : (shift.responsibility_pay === 'hourly' ? round2(paidHours * (rates.responsibility_hourly || 0))
        : shift.responsibility_pay === 'flat' ? (rates.responsibility_flat || 0) : 0),
    preceptor: overrides.preceptor != null ? overrides.preceptor
      : (shift.preceptor ? round2(paidHours * (rates.preceptor || 0)) : 0),
    specialty: overrides.specialty != null ? overrides.specialty
      : (shift.specialty_premium ? round2(paidHours * (rates.specialty || 0)) : 0),
  };
}

function premiumSum(p) {
  return (p.evening||0)+(p.night||0)+(p.weekend||0)+(p.super_shift||0)
    +(p.regular_premium||0)+(p.short_notice||0)+(p.responsibility||0)+(p.preceptor||0)+(p.specialty||0);
}

// ── Tax / statutory estimation (inlined from taxCalculator) ──
const BC_BRACKETS = [
  { threshold: 50363, rate: 0.056 },{ threshold: 100728, rate: 0.077 },{ threshold: 115648, rate: 0.105 },
  { threshold: 140430, rate: 0.1229 },{ threshold: 190405, rate: 0.147 },{ threshold: 265545, rate: 0.168 },{ threshold: Infinity, rate: 0.205 }
];
const FED_BRACKETS = [
  { threshold: 58523, rate: 0.14 },{ threshold: 117045, rate: 0.205 },{ threshold: 181440, rate: 0.26 },
  { threshold: 258482, rate: 0.29 },{ threshold: Infinity, rate: 0.33 }
];
function marginalRate(brackets, income) { for (const b of brackets) { if (income <= b.threshold) return b.rate; } return brackets[brackets.length-1].rate; }

function estimateDeductions(bd, taxSettings) {
  const gross = bd.gross_pay || 0;
  const pensionable = bd.straight_time_pay || 0;
  const annualFederal = taxSettings?.annual_federal_income || 0;
  const annualProvincial = taxSettings?.annual_provincial_income || 0;
  if (gross <= 0 || annualFederal <= 0) return {};

  // CPP
  const cppAnnual = annualFederal > 3500 ? Math.min((Math.min(annualFederal, 74600) - 3500) * 0.0595, 4230.45) : 0;
  // CPP2
  const cpp2Annual = annualFederal > 74600 ? Math.min((Math.min(annualFederal, 85000) - 74600) * 0.04, 416) : 0;
  // EI
  const eiAnnual = Math.min(Math.min(annualFederal, 68900) * 0.0163, 1123.07);

  const ratio = pensionable / annualFederal;
  const eiRatio = gross / annualFederal;

  const provincial = annualProvincial > 0 ? gross * marginalRate(BC_BRACKETS, annualProvincial) : 0;
  const federal = annualFederal > 0 ? gross * marginalRate(FED_BRACKETS, annualFederal) : 0;

  return {
    cpp: round2(cppAnnual * ratio),
    cpp2: round2(cpp2Annual * ratio),
    ei: round2(eiAnnual * eiRatio),
    federal_tax: round2(federal),
    provincial_tax: round2(provincial),
  };
}

// ── Main ──
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { periodId } = await req.json();
    if (!periodId) return Response.json({ error: 'Missing periodId' }, { status: 400 });

    const [period, settingsList] = await Promise.all([
      base44.entities.PayPeriod.get(periodId),
      base44.entities.Settings.list(),
    ]);
    if (!period) return Response.json({ error: 'Period not found' }, { status: 404 });
    const settings = settingsList[0] || {};
    const wage = settings.hourly_wage || 0;
    const rates = settings.premium_rates || {};

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = M;

    // ── Header ──
    doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...COLORS.primary);
    doc.text('Pay Period Summary', M, y); y += 8;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...COLORS.muted);
    const genDate = new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    doc.text(`Generated ${genDate} for ${safe(user.full_name || user.email)}`, M, y);
    y += 12;

    // ── Period Info Box ──
    doc.setFillColor(...COLORS.light).setDrawColor(...COLORS.border).setLineWidth(0.3);
    doc.roundedRect(M, y, PW, 18, 3, 3, 'FD');
    const startFmt = new Date(period.start_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    const endFmt = new Date(period.end_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...COLORS.dark);
    doc.text(`${startFmt} to ${endFmt}`, M + 4, y + 8);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...COLORS.muted);
    doc.text(`${period.shifts?.length || 0} shifts`, M + PW - 4, y + 8, { align: 'right' });
    y += 24;

    // ── Shifts Table with per-shift breakdown ──
    const shifts = [...(period.shifts || [])].sort((a, b) => a.date.localeCompare(b.date));
    if (shifts.length > 0) {
      const colStatus = M, colType = M + 20, colTime = M + 38, colBreakdown = M + 108, colGross = M + PW;

      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...COLORS.primary);
      doc.text('Status', colStatus, y); doc.text('Type', colType, y);
      doc.text('Date / Time', colTime, y); doc.text('Pay Breakdown', colBreakdown, y);
      doc.text('Gross', colGross, y, { align: 'right' });
      y += 2;
      doc.setDrawColor(...COLORS.border).setLineWidth(0.2);
      doc.line(M, y, M + PW, y);
      y += 6;

      doc.setFont('helvetica', 'normal').setFontSize(8);

      for (const shift of shifts) {
        if (y > PAGE_H - 26) { doc.addPage(); y = M; }

        const dt = new Date(shift.date + 'T12:00:00');
        const dateLabel = dt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
        const timeStr = `${dateLabel}  ${shift.start_time}-${shift.end_time}`;

        doc.setTextColor(...COLORS.dark);
        doc.text(safe(shift.status || 'pending'), colStatus, y);
        doc.text(safe(shift.shift_type || 'regular'), colType, y);
        doc.text(safe(timeStr), colTime, y);

        // Per-shift pay: straight time + overtime + premiums
        const segments = splitOvernight(shift);
        let stPay = 0, otPay = 0;
        for (const seg of segments) {
          const mult = getSegMultiplier(shift.shift_type, seg.date);
          if (mult === 1.0) stPay += seg.hours * wage;
          else if (mult > 0) otPay += seg.hours * wage * mult;
        }
        const premiums = shiftPremiums(shift, rates);
        const premTotal = premiumSum(premiums);
        const shiftGross = round2(stPay + otPay + premTotal);

        // Breakdown text: ST $X + Prem $Y
        const parts = [];
        if (stPay > 0) parts.push(`ST ${fmtCurrency(stPay)}`);
        if (otPay > 0) parts.push(`OT ${fmtCurrency(otPay)}`);
        if (premTotal > 0) parts.push(`Prem ${fmtCurrency(premTotal)}`);
        if (parts.length === 0) parts.push('$0.00');
        doc.text(parts.join('  +  '), colBreakdown, y);

        doc.text(fmtCurrency(shiftGross), colGross, y, { align: 'right' });
        y += 5;

        if (shift.hospital || shift.unit) {
          doc.setTextColor(...COLORS.muted).setFontSize(7);
          doc.text(safe([shift.hospital, shift.unit].filter(Boolean).join(' / ')), colTime, y);
          doc.setFontSize(8);
          y += 4.5;
        }
      }
    }

    // ── Pay Breakdown Summary ──
    y += 8;
    if (y > PAGE_H - 80) { doc.addPage(); y = M; }

    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...COLORS.primary);
    doc.text('Pay Breakdown', M, y); y += 8;

    const bd = period.breakdown || {};

    const drawRow = (label, value, bold, color = COLORS.dark) => {
      if (y > PAGE_H - 20) { doc.addPage(); y = M; }
      doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(9).setTextColor(...color);
      doc.text(label, M, y);
      doc.text(fmtCurrency(value), M + PW, y, { align: 'right' });
      y += 5.5;
    };
    const secHeader = (label) => {
      if (y > PAGE_H - 20) { doc.addPage(); y = M; }
      doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...COLORS.muted);
      doc.text(label, M, y); y += 5;
    };

    // Base Pay
    secHeader('BASE PAY');
    if (bd.straight_time_pay) drawRow('Straight Time', bd.straight_time_pay);
    if (bd.overtime_pay) drawRow('Overtime / Stat Pay', bd.overtime_pay);
    const basePayTotal = (bd.straight_time_pay || 0) + (bd.overtime_pay || 0);
    if (bd.straight_time_pay && bd.overtime_pay) {
      drawRow('Subtotal: Base Pay', basePayTotal, true);
      y += 2;
    }

    // Premiums
    const premRows = [
      ['Evening Premium', bd.evening_premium_total], ['Night Premium', bd.night_premium_total],
      ['Weekend Premium', bd.weekend_premium_total], ['Super Shift Premium', bd.super_shift_premium_total],
      ['Regular Premium', bd.regular_premium_total], ['Short Notice', bd.short_notice_total],
      ['Responsibility', bd.responsibility_total], ['Preceptor', bd.preceptor_total],
      ['Specialty Premium', bd.specialty_premium_total],
    ].filter(r => r[1] > 0);
    if (premRows.length > 0) {
      y += 2; secHeader('PREMIUMS');
      premRows.forEach(([l, v]) => drawRow(l, v));
      const premSum = premRows.reduce((s, r) => s + r[1], 0);
      drawRow('Subtotal: Premiums', premSum, true);
      y += 2;
    }

    // Other
    const others = [['On Call', bd.on_call_total], ['Allowances', bd.allowance_total], ['Qualifications', bd.qualification_total]].filter(r => r[1] > 0);
    if (others.length > 0) {
      secHeader('OTHER');
      others.forEach(([l, v]) => drawRow(l, v));
    }

    // Union dues
    if (bd.union_dues > 0) {
      y += 2; secHeader('DEDUCTIONS FROM GROSS');
      drawRow('Union Dues', -bd.union_dues);
    }

    // Gross total
    y += 4;
    if (y > PAGE_H - 20) { doc.addPage(); y = M; }
    doc.setDrawColor(...COLORS.primary).setLineWidth(0.6);
    doc.line(M, y, M + PW, y); y += 7;
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...COLORS.primary);
    doc.text('Gross Pay', M, y);
    doc.text(fmtCurrency(bd.gross_pay || 0), M + PW, y, { align: 'right' });
    y += 14;

    // ── Statutory Deductions (estimated + verified) ──
    const vd = period.verified_deductions || {};
    const est = estimateDeductions(bd, settings.tax_settings || {});

    // Merge: verified overrides estimated
    const finalDed = {
      cpp: vd.cpp != null ? vd.cpp : est.cpp || 0,
      cpp2: vd.cpp2 != null ? vd.cpp2 : est.cpp2 || 0,
      ei: vd.ei != null ? vd.ei : est.ei || 0,
      federal_tax: vd.federal_tax != null ? vd.federal_tax : est.federal_tax || 0,
      provincial_tax: vd.provincial_tax != null ? vd.provincial_tax : est.provincial_tax || 0,
      union_dues: vd.union_dues != null ? vd.union_dues : bd.union_dues || 0,
      other: vd.other_deductions || 0,
    };

    const hasVerified = vd && Object.keys(vd).some(k => ['cpp','cpp2','ei','federal_tax','provincial_tax'].includes(k) && vd[k] > 0);
    const dedLabel = hasVerified ? 'DEDUCTIONS (VERIFIED FROM PAY STUB)' : 'ESTIMATED STATUTORY DEDUCTIONS';
    if (y > PAGE_H - 50) { doc.addPage(); y = M; }

    secHeader(dedLabel);

    const dedRows = [
      ['CPP', finalDed.cpp],
      ['CPP2', finalDed.cpp2],
      ['EI', finalDed.ei],
      ['Federal Income Tax', finalDed.federal_tax],
      ['Provincial Income Tax', finalDed.provincial_tax],
      ['Union Dues', finalDed.union_dues],
    ];
    if (finalDed.other > 0) dedRows.push([vd.other_label ? safe(vd.other_label) : 'Other Deductions', finalDed.other]);

    const activeDedRows = dedRows.filter(r => r[1] > 0);

    if (activeDedRows.length > 0) {
      activeDedRows.forEach(([l, v]) => drawRow(l, -v));
      const totalDed = activeDedRows.reduce((s, r) => s + r[1], 0);
      const netPay = round2((bd.gross_pay || 0) - totalDed);
      y += 4;
      doc.setDrawColor(...COLORS.border).setLineWidth(0.3);
      doc.line(M, y, M + PW, y); y += 6;
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...COLORS.dark);
      doc.text('Estimated Net Pay', M, y);
      doc.text(fmtCurrency(netPay), M + PW, y, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...COLORS.muted);
      doc.text('Insufficient income data to estimate deductions. Set annual income in Settings.', M, y);
    }

    // ── Footer ──
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...COLORS.muted);
      doc.text(`NursePayCheck  |  Page ${i} of ${totalPages}  |  ${genDate}`, M + PW / 2, PAGE_H - 8, { align: 'center' });
    }

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="pay-period-${period.start_date}.pdf"` },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});