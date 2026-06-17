import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

const PP_MARGIN = 18;
const PP_WIDTH = 210 - PP_MARGIN * 2;
const COLORS = { primary: [23, 162, 140], muted: [140, 150, 160], dark: [30, 35, 40], light: [245, 247, 250] };
const PAGE_H = 297;

function fmtCurrency(n) {
  if (n == null) return '$0.00';
  return '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    let y = PP_MARGIN;

    // ── Header ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.primary);
    doc.text('Pay Period Summary', PP_MARGIN, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Generated ${new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })} for ${user.full_name || user.email}`, PP_MARGIN, y);
    y += 12;

    // ── Period Info Box ──
    doc.setFillColor(...COLORS.light);
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.3);
    doc.roundedRect(PP_MARGIN, y, PP_WIDTH, 18, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.dark);
    const periodName = [period.start_date, period.end_date].map(d => {
      const dt = new Date(d + 'T12:00:00');
      return dt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    }).join(' \u2013 ');
    doc.text(periodName, PP_MARGIN + 4, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(`${period.shifts?.length || 0} shifts`, PP_WIDTH - 40, y + 8);
    y += 24;

    // ── Shifts Table ──
    if (period.shifts?.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.primary);
      const cols = [22, 18, 70, 30, 34];
      const colX = [PP_MARGIN, PP_MARGIN + cols[0], PP_MARGIN + cols[0] + cols[1], PP_MARGIN + cols[0] + cols[1] + cols[2], PP_MARGIN + cols[0] + cols[1] + cols[2] + cols[3]];
      const headers = ['Status', 'Type', 'Time', 'Hours', 'Gross Pay'];
      headers.forEach((h, i) => doc.text(h, colX[i], y));
      y += 2;
      doc.setDrawColor(...COLORS.muted);
      doc.setLineWidth(0.1);
      doc.line(PP_MARGIN, y, PP_MARGIN + PP_WIDTH, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const shifts = [...period.shifts].sort((a, b) => a.date.localeCompare(b.date));
      const wage = settings.hourly_wage || 0;

      for (const shift of shifts) {
        if (y > PAGE_H - 25) { doc.addPage(); y = PP_MARGIN; }

        const dt = new Date(shift.date + 'T12:00:00');
        const dateLabel = dt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

        doc.setTextColor(...COLORS.dark);
        doc.text(shift.status || 'pending', colX[0], y);
        doc.text(shift.shift_type || 'regular', colX[1], y);
        const timeStr = `${dateLabel}  ${shift.start_time}\u2013${shift.end_time}`;
        doc.text(timeStr, colX[2], y);
        doc.text(String(shift.paid_hours || 0), colX[3], y, { align: 'right' });

        // approximate gross for this shift
        const paid = shift.paid_hours || 0;
        const grossEstimate = paid * wage;
        doc.text(fmtCurrency(grossEstimate), colX[4], y, { align: 'right' });

        y += 4.5;
        if (shift.hospital || shift.unit) {
          doc.setTextColor(...COLORS.muted);
          doc.setFontSize(7);
          const loc = [shift.hospital, shift.unit].filter(Boolean).join(' \u00b7 ');
          doc.text(loc, colX[2], y);
          doc.setFontSize(8);
          y += 4;
        }
      }
    }

    // ── Breakdown ──
    y += 6;
    if (y > PAGE_H - 60) { doc.addPage(); y = PP_MARGIN; }

    const breakdown = period.breakdown || {};
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primary);
    doc.text('Pay Breakdown', PP_MARGIN, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const rows = [
      ['Straight Time', breakdown.straight_time_pay],
      ['Overtime / Stat', breakdown.overtime_pay],
      ['Evening Premium', breakdown.evening_premium_total],
      ['Night Premium', breakdown.night_premium_total],
      ['Weekend Premium', breakdown.weekend_premium_total],
      ['Super Shift Premium', breakdown.super_shift_premium_total],
      ['Regular Premium', breakdown.regular_premium_total],
      ['Specialty Premium', breakdown.specialty_premium_total],
      ['Short Notice', breakdown.short_notice_total],
      ['Responsibility', breakdown.responsibility_total],
      ['Preceptor', breakdown.preceptor_total],
      ['On Call', breakdown.on_call_total],
      ['Allowances', breakdown.allowance_total],
      ['Qualifications', breakdown.qualification_total],
      ['Union Dues', breakdown.union_dues ? -breakdown.union_dues : null],
    ].filter(r => r[1] != null && r[1] !== 0);

    const labelX = PP_MARGIN;
    const amountX = PP_MARGIN + PP_WIDTH;

    for (const [label, value] of rows) {
      doc.setTextColor(...COLORS.dark);
      doc.text(label, labelX, y);
      doc.text(fmtCurrency(value), amountX, y, { align: 'right' });
      y += 5;
    }

    // Gross total line
    y += 3;
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(PP_MARGIN, y, PP_MARGIN + PP_WIDTH, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text('Gross Pay', labelX, y);
    doc.text(fmtCurrency(breakdown.gross_pay), amountX, y, { align: 'right' });

    // ── Deductions section ──
    if (period.verified_deductions || breakdown.union_dues) {
      y += 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.muted);
      doc.text('Deductions (estimated)', PP_MARGIN, y);
      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      // Use verified deductions if available
      const vd = period.verified_deductions || {};
      const dedRows = [
        ['CPP', vd.cpp],
        ['CPP2', vd.cpp2],
        ['EI', vd.ei],
        ['Federal Tax', vd.federal_tax],
        ['Provincial Tax', vd.provincial_tax],
        ['Union Dues', vd.union_dues || (breakdown.union_dues || 0)],
        ['Other', vd.other_deductions],
      ].filter(r => r[1] != null && r[1] !== 0);

      for (const [label, value] of dedRows) {
        doc.setTextColor(...COLORS.dark);
        doc.text(label, labelX, y);
        doc.text('-' + fmtCurrency(value), amountX, y, { align: 'right' });
        y += 5;
      }
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