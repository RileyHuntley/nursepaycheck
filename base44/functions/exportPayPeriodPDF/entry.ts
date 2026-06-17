import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

const M = 18; // left/right margin
const PW = 210 - M * 2; // printable width
const COLORS = {
  primary: [23, 162, 140],
  muted: [140, 150, 160],
  dark: [30, 35, 40],
  light: [245, 247, 250],
  border: [220, 225, 230],
};
const PAGE_H = 297;

function fmtCurrency(n) {
  if (n == null || n === 0) return null;
  const abs = Math.abs(n);
  return (n < 0 ? '-' : '') + '$' + abs.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCurrencyForce(n) {
  const abs = Math.abs(n || 0);
  return (n < 0 ? '-' : '') + '$' + abs.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// jsPDF uses latin1 by default — replace unicode chars with ASCII equivalents
function safe(str) {
  if (!str) return '';
  return String(str)
    .replace(/\u2013|\u2014/g, '-')   // en-dash, em-dash -> hyphen
    .replace(/\u00b7|\u00B7/g, '.')   // middle dot -> period
    .replace(/\u2019|\u2018/g, "'")   // smart quotes
    .replace(/[^\x00-\xFF]/g, '?');   // anything else outside latin1
}

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

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = M;

    // ── Header ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...COLORS.primary);
    doc.text('Pay Period Summary', M, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    const genDate = new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    doc.text(`Generated ${genDate} for ${safe(user.full_name || user.email)}`, M, y);
    y += 12;

    // ── Period Info Box ──
    doc.setFillColor(...COLORS.light);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, PW, 18, 3, 3, 'FD');

    const startFmt = new Date(period.start_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    const endFmt = new Date(period.end_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    const periodLabel = `${startFmt} to ${endFmt}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.dark);
    doc.text(periodLabel, M + 4, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(`${period.shifts?.length || 0} shifts`, M + PW - 4, y + 8, { align: 'right' });
    y += 24;

    // ── Shifts Table ──
    const shifts = [...(period.shifts || [])].sort((a, b) => a.date.localeCompare(b.date));
    if (shifts.length > 0) {
      // Column positions
      const colStatus = M;
      const colType = M + 22;
      const colTime = M + 44;
      const colHours = M + 118;
      const colGross = M + PW;

      // Header row
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.primary);
      doc.text('Status', colStatus, y);
      doc.text('Type', colType, y);
      doc.text('Date / Time', colTime, y);
      doc.text('Hours', colHours, y);
      doc.text('Gross Pay', colGross, y, { align: 'right' });
      y += 2;
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(M, y, M + PW, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);

      const wage = settings.hourly_wage || 0;

      for (const shift of shifts) {
        if (y > PAGE_H - 30) { doc.addPage(); y = M; }

        const dt = new Date(shift.date + 'T12:00:00');
        const dateLabel = dt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
        const timeStr = `${dateLabel}  ${shift.start_time}-${shift.end_time}`;

        doc.setTextColor(...COLORS.dark);
        doc.text(safe(shift.status || 'pending'), colStatus, y);
        doc.text(safe(shift.shift_type || 'regular'), colType, y);
        doc.text(safe(timeStr), colTime, y);
        doc.text(String(shift.paid_hours || 0), colHours, y);

        const grossEst = (shift.paid_hours || 0) * wage;
        doc.text(fmtCurrencyForce(grossEst), colGross, y, { align: 'right' });
        y += 5;

        if (shift.hospital || shift.unit) {
          doc.setTextColor(...COLORS.muted);
          doc.setFontSize(7.5);
          const loc = [shift.hospital, shift.unit].filter(Boolean).join(' / ');
          doc.text(safe(loc), colTime, y);
          doc.setFontSize(8.5);
          y += 4.5;
        }
      }
    }

    // ── Pay Breakdown ──
    y += 8;
    if (y > PAGE_H - 80) { doc.addPage(); y = M; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text('Pay Breakdown', M, y);
    y += 8;

    const bd = period.breakdown || {};

    // Helper to draw a line item row
    const drawRow = (label, value, bold = false, color = COLORS.dark) => {
      if (y > PAGE_H - 20) { doc.addPage(); y = M; }
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...color);
      doc.text(label, M, y);
      doc.text(fmtCurrencyForce(value), M + PW, y, { align: 'right' });
      y += 5.5;
    };

    const drawSectionHeader = (label) => {
      if (y > PAGE_H - 20) { doc.addPage(); y = M; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      doc.text(label, M, y);
      y += 5;
    };

    // Base pay
    drawSectionHeader('BASE PAY');
    if (bd.straight_time_pay) drawRow('Straight Time', bd.straight_time_pay);
    if (bd.overtime_pay) drawRow('Overtime / Stat Pay', bd.overtime_pay);

    // Premiums
    const premiums = [
      ['Evening Premium', bd.evening_premium_total],
      ['Night Premium', bd.night_premium_total],
      ['Weekend Premium', bd.weekend_premium_total],
      ['Super Shift Premium', bd.super_shift_premium_total],
      ['Regular Premium', bd.regular_premium_total],
      ['Short Notice', bd.short_notice_total],
      ['Responsibility', bd.responsibility_total],
      ['Preceptor', bd.preceptor_total],
      ['Specialty Premium', bd.specialty_premium_total],
    ].filter(r => r[1] > 0);

    if (premiums.length > 0) {
      y += 2;
      drawSectionHeader('PREMIUMS');
      premiums.forEach(([label, value]) => drawRow(label, value));
    }

    // Other
    const others = [
      ['On Call', bd.on_call_total],
      ['Allowances', bd.allowance_total],
      ['Qualifications', bd.qualification_total],
    ].filter(r => r[1] > 0);

    if (others.length > 0) {
      y += 2;
      drawSectionHeader('OTHER');
      others.forEach(([label, value]) => drawRow(label, value));
    }

    // Union dues (deduction from gross)
    if (bd.union_dues > 0) {
      y += 2;
      drawSectionHeader('DEDUCTIONS FROM GROSS');
      drawRow('Union Dues', -bd.union_dues);
    }

    // Gross total line
    y += 4;
    if (y > PAGE_H - 20) { doc.addPage(); y = M; }
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.6);
    doc.line(M, y, M + PW, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.primary);
    doc.text('Gross Pay', M, y);
    doc.text(fmtCurrencyForce(bd.gross_pay || 0), M + PW, y, { align: 'right' });
    y += 14;

    // ── Statutory Deductions ──
    const vd = period.verified_deductions || {};
    const hasVerified = vd && Object.keys(vd).some(k => ['cpp', 'cpp2', 'ei', 'federal_tax', 'provincial_tax'].includes(k) && vd[k] > 0);

    const dedLabel = hasVerified ? 'DEDUCTIONS (VERIFIED FROM PAY STUB)' : 'ESTIMATED STATUTORY DEDUCTIONS';
    if (y > PAGE_H - 40) { doc.addPage(); y = M; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(dedLabel, M, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const dedRows = [
      ['CPP', vd.cpp],
      ['CPP2', vd.cpp2],
      ['EI', vd.ei],
      ['Federal Income Tax', vd.federal_tax],
      ['Provincial Income Tax', vd.provincial_tax],
      ['Union Dues', vd.union_dues || bd.union_dues],
      [vd.other_label ? safe(vd.other_label) : 'Other', vd.other_deductions],
    ].filter(r => r[1] != null && r[1] > 0);

    if (dedRows.length > 0) {
      dedRows.forEach(([label, value]) => drawRow(label, -value));

      // Net pay
      const totalDed = dedRows.reduce((s, r) => s + (r[1] || 0), 0);
      const netPay = (bd.gross_pay || 0) - totalDed;
      y += 4;
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.3);
      doc.line(M, y, M + PW, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.dark);
      doc.text('Estimated Net Pay', M, y);
      doc.text(fmtCurrencyForce(netPay), M + PW, y, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.muted);
      doc.text('No deductions entered. Add verified deductions on the Last Pay Period page.', M, y);
    }

    // ── Footer ──
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.muted);
      doc.text(`NursePayCheck  |  Page ${i} of ${totalPages}  |  ${genDate}`, M + PW / 2, PAGE_H - 8, { align: 'center' });
    }

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="pay-period-${period.start_date}.pdf"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});