import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

// ── Constants ──
const M = 16;
const PW = 210 - M * 2;
const PAGE_H = 297;
const COL = { primary: [23,162,140], muted: [140,150,160], dark: [30,35,40], light: [245,247,250], border: [220,225,230], accent: [220,38,38] };

// ── Utilities ──
function r2(n) { return Math.round(n * 100) / 100; }
function fm$(n) { return (n < 0 ? '-' : '') + '$' + Math.abs(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 }); }
function safe(s) { if (!s) return ''; return String(s).replace(/\u2013|\u2014/g,'-').replace(/\u00b7/g,'.').replace(/\u2019|\u2018|\u201c|\u201d/g,"'").replace(/\u00d7/g,'x').replace(/\u00f7/g,'/').replace(/\u2026/g,'...').replace(/[^\x00-\xFF]/g,'?'); }
function pt(t) { if (!t) return 0; const [h,m] = t.replace('.',':').split(':').map(Number); return h + (m||0)/60; }
function fmtTime(d) { let h = Math.floor(d) % 24; return `${String(h).padStart(2,'0')}:${String(Math.round((d-Math.floor(d))*60)).padStart(2,'0')}`; }
function hrsInRange(sS,sE,rS,rE) { if(sS>=sE)sE+=24; if(rS>=rE)rE+=24; const oS=Math.max(sS,rS),oE=Math.min(sE,rE); return oS<oE?oE-oS:0; }
function span(s,e) { const st=pt(s); let en=pt(e); if(en<=st)en+=24; return en-st; }

// ── Stat holidays ──
const SUPER_2026 = ['2026-01-01','2026-04-03','2026-04-06','2026-05-18','2026-07-01','2026-09-07','2026-10-12','2026-11-11','2026-12-25','2026-12-26'];
const STAT_2026 = ['2026-02-16','2026-08-03'];
const SUPER_2027 = ['2027-01-01','2027-03-26','2027-03-29','2027-05-24','2027-07-01','2027-09-06','2027-10-11','2027-11-11','2027-12-25','2027-12-27'];
const STAT_2027 = ['2027-02-15','2027-08-02'];
function statType(d) { for(const x of SUPER_2026) if(d===x) return 'super'; for(const x of SUPER_2027) if(d===x) return 'super'; for(const x of STAT_2026) if(d===x) return 'regular'; for(const x of STAT_2027) if(d===x) return 'regular'; return null; }

// ── Overnight split ──
function splitOvernight(shift) {
  const startH = pt(shift.start_time); let endH = pt(shift.end_time);
  const ub = shift.unpaid_break || 0;
  const pb = shift.paid_break || 0;
  if (endH > startH) { const cl = endH - startH; const ent = cl >= 10 ? 0.75 : 0; const h = shift.paid_hours || (cl - ub + Math.max(0, ent - pb)); return [{ date: shift.date, hours: r2(h) }]; }
  endH += 24; const bc = 24 - startH, ac = endH - 24; const cl2 = bc + ac; const ent2 = cl2 >= 10 ? 0.75 : 0; const bonus = Math.max(0, ent2 - pb); let bp, ap;
  if (ub > 0 && cl2 >= 5) { const bs = startH + 5, be = bs + ub; const bw = bc - Math.max(0, Math.min(be,24) - bs); const aw = ac - Math.max(0, be - Math.max(bs,24)); const tw = bw + aw; bp = r2(bw + (tw > 0 ? (bw/tw)*bonus : 0)); ap = r2(aw + (tw > 0 ? (aw/tw)*bonus : 0)); }
  else { const ph = shift.paid_hours || (cl2 - ub + bonus); bp = r2((bc/cl2)*ph); ap = r2((ac/cl2)*ph); }
  const next = new Date(shift.date + 'T12:00:00'); next.setDate(next.getDate()+1);
  return [{ date: shift.date, hours: bp }, { date: next.toISOString().slice(0,10), hours: ap }];
}

// ── Segment multiplier ──
function segMult(stype, sdate) {
  const bm = { day_off: 2.0, unpaid_vacation: 0, unpaid_sick: 0 }; const base = bm[stype] ?? 1.0;
  if (base === 0) return 0;
  const st = statType(sdate);
  if (stype === 'day_off') return st ? 3.0 : 2.0;
  const straight = ['casual','regular','isn','vacation','paid_vacation','sick','paid_sick','special_leave','pdo_pst','other_leave'];
  if (straight.includes(stype)) { if (st === 'super') return 2.5; if (st === 'regular') return 2.0; return 1.0; }
  return base;
}

// ── Shift premiums ──
function shiftPremiums(shift, rates) {
  const ph = shift.paid_hours || 0;
  const isSt = ['casual','regular','isn','vacation','paid_vacation','sick','paid_sick','special_leave','pdo_pst','other_leave'].includes(shift.shift_type);
  const sp = span(shift.start_time, shift.end_time);
  const ext = sp >= 10;
  const s = pt(shift.start_time), e = pt(shift.end_time);
  let eveH=0, nightH=0;
  if (ext) { eveH = hrsInRange(s,e,15.5,23.5); nightH = hrsInRange(s,e,23.5,31.5); }
  else { const et = hrsInRange(s,e,15.5,23.5), nt = hrsInRange(s,e,23.5,31.5); if (et>nt && et>sp/2) eveH=ph; else if (nt>et && nt>sp/2) nightH=ph; }
  const dow = new Date(shift.date + 'T12:00:00').getUTCDay();
  let wkndH=0; const cap = h => Math.min(h, ph);
  if (dow===5) wkndH = hrsInRange(s,e,23,47); else if (dow===6) wkndH = hrsInRange(s,e,0,47); else if (dow===0) wkndH = hrsInRange(s,e,0,23);
  let superH=0; if (dow===5) superH = hrsInRange(s,e,23.5,31.5); else if (dow===6) superH = hrsInRange(s,e,23.5,31.5);
  eveH=cap(eveH); nightH=cap(nightH); wkndH=cap(wkndH); superH=cap(superH);
  const ov = shift.premium_overrides || {};
  return {
    evening: ov.evening!=null?ov.evening:r2(eveH*(rates.evening||0)), eveH: r2(eveH),
    night: ov.night!=null?ov.night:r2(nightH*(rates.night||0)), nightH: r2(nightH),
    weekend: ov.weekend!=null?ov.weekend:r2(wkndH*(rates.weekend||0)), wkndH: r2(wkndH),
    super_shift: ov.super_shift!=null?ov.super_shift:r2(superH*(rates.super_shift||0)), superH: r2(superH),
    regular_premium: ov.regular_premium!=null?ov.regular_premium:(isSt?r2(ph*(rates.regular_premium||0)):0),
    short_notice: ov.short_notice!=null?ov.short_notice:(shift.short_notice?r2(ph*(rates.short_notice||0)):0),
    responsibility: ov.responsibility!=null?ov.responsibility:(shift.responsibility_pay==='hourly'?r2(ph*(rates.responsibility_hourly||0)):shift.responsibility_pay==='flat'?(rates.responsibility_flat||0):0),
    preceptor: ov.preceptor!=null?ov.preceptor:(shift.preceptor?r2(ph*(rates.preceptor||0)):0),
    specialty: ov.specialty!=null?ov.specialty:(shift.specialty_premium?r2(ph*(rates.specialty||0)):0),
  };
}
function premSum(p) { return (p.evening||0)+(p.night||0)+(p.weekend||0)+(p.super_shift||0)+(p.regular_premium||0)+(p.short_notice||0)+(p.responsibility||0)+(p.preceptor||0)+(p.specialty||0); }

// ── Tax estimation ──
const BC_B = [{t:50363,r:.056},{t:100728,r:.077},{t:115648,r:.105},{t:140430,r:.1229},{t:190405,r:.147},{t:265545,r:.168},{t:1/0,r:.205}];
const FED_B = [{t:58523,r:.14},{t:117045,r:.205},{t:181440,r:.26},{t:258482,r:.29},{t:1/0,r:.33}];
function mRate(b, inc) { for(const x of b) if(inc<=x.t) return x.r; return b[b.length-1].r; }
function estDed(bd, ts) {
  const g = bd.gross_pay||0, pen = bd.straight_time_pay||0, af = ts?.annual_federal_income||0, ap = ts?.annual_provincial_income||0;
  if (g<=0||af<=0) return null;
  const cppY = af>3500?Math.min((Math.min(af,74600)-3500)*.0595,4230.45):0;
  const cpp2Y = af>74600?Math.min((Math.min(af,85000)-74600)*.04,416):0;
  const eiY = Math.min(Math.min(af,68900)*.0163,1123.07);
  return {
    cpp: r2(cppY*(pen/af)), cpp2: r2(cpp2Y*(pen/af)), ei: r2(eiY*(g/af)),
    fed: r2(g*mRate(FED_B, af)), prov: r2(ap>0?g*mRate(BC_B, ap):0),
  };
}

// ── VCH period number lookup ──
const VCH_2026 = [
  ['2025-12-29','2026-01-11','2026-01-16'],['2026-01-12','2026-01-25','2026-01-30'],['2026-01-26','2026-02-08','2026-02-13'],
  ['2026-02-09','2026-02-22','2026-02-27'],['2026-02-23','2026-03-08','2026-03-13'],['2026-03-09','2026-03-22','2026-03-27'],
  ['2026-03-23','2026-04-05','2026-04-10'],['2026-04-06','2026-04-19','2026-04-24'],['2026-04-20','2026-05-03','2026-05-08'],
  ['2026-05-04','2026-05-17','2026-05-22'],['2026-05-18','2026-05-31','2026-06-05'],['2026-06-01','2026-06-14','2026-06-19'],
  ['2026-06-15','2026-06-28','2026-07-03'],['2026-06-29','2026-07-12','2026-07-17'],['2026-07-13','2026-07-26','2026-07-31'],
  ['2026-07-27','2026-08-09','2026-08-14'],['2026-08-10','2026-08-23','2026-08-28'],['2026-08-24','2026-09-06','2026-09-11'],
  ['2026-09-07','2026-09-20','2026-09-25'],['2026-09-21','2026-10-04','2026-10-09'],['2026-10-05','2026-10-18','2026-10-23'],
  ['2026-10-19','2026-11-01','2026-11-06'],['2026-11-02','2026-11-15','2026-11-20'],['2026-11-16','2026-11-29','2026-12-04'],
  ['2026-11-30','2026-12-13','2026-12-18'],['2026-12-14','2026-12-27','2027-01-01'],
];
function getPPNum(start) { for(let i=0;i<VCH_2026.length;i++) if(VCH_2026[i][0]===start) return i+1; return null; }
function getPayDate(start) { for(const p of VCH_2026) if(p[0]===start) return p[2]; return null; }

// ── Shift type display names ──
const TYPE_LABELS = { casual:'Casual', regular:'Regular', day_off:'Day Off', isn:'ISN', vacation:'Paid Vacation', sick:'Paid Sick', unpaid_vacation:'Unpaid Vacation', unpaid_sick:'Unpaid Sick', special_leave:'Special Leave', pdo_pst:'PDO/PST', other_leave:'Other Leave' };

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

    // ── HEADER ──
    doc.setFont('helvetica','bold').setFontSize(20).setTextColor(...COL.primary);
    doc.text('Current Pay Period', M, y); y += 8;

    const genDate = new Date().toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});
    doc.setFont('helvetica','normal').setFontSize(9).setTextColor(...COL.muted);
    doc.text(`Generated ${genDate} for ${safe(user.full_name||user.email)}`, M, y);
    y += 12;

    // ── PERIOD INFO BOX ──
    doc.setFillColor(...COL.light).setDrawColor(...COL.border).setLineWidth(0.3);
    doc.roundedRect(M, y, PW, 20, 3, 3, 'FD');
    const ppNum = getPPNum(period.start_date);
    const payDate = getPayDate(period.start_date);
    const startFmt = new Date(period.start_date+'T12:00:00').toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});
    const endFmt = new Date(period.end_date+'T12:00:00').toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});
    const pdFmt = payDate ? new Date(payDate+'T12:00:00').toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}) : null;

    doc.setFont('helvetica','bold').setFontSize(12).setTextColor(...COL.dark);
    doc.text(`${startFmt} to ${endFmt}`, M + 4, y + 8);
    doc.setFont('helvetica','normal').setFontSize(9).setTextColor(...COL.muted);
    let infoX = M + PW;
    const infoParts = [];
    if (ppNum) infoParts.push(`PP ${ppNum}`);
    infoParts.push(`${period.shifts?.length || 0} shifts`);
    if (payDate) infoParts.push(`Pay ${pdFmt}`);
    doc.text(infoParts.join('  |  '), M + PW - 4, y + 8, { align: 'right' });

    // VCH period badge
    if (ppNum) {
      doc.setFillColor(235,238,242);
      doc.roundedRect(M + 4, y + 2, 14, 5, 1.5, 1.5, 'F');
      doc.setFont('helvetica','bold').setFontSize(7).setTextColor(...COL.muted);
      doc.text(`PP ${ppNum}`, M + 11, y + 5.5, { align: 'center' });
      doc.setFillColor(...COL.light);
    }
    y += 26;

    // ── SHIFTS TABLE ──
    const shifts = [...(period.shifts||[])].sort((a,b)=>a.date.localeCompare(b.date));
    if (shifts.length > 0) {
      doc.setFont('helvetica','bold').setFontSize(10).setTextColor(...COL.primary);
      doc.text('Shift Log', M, y); y += 7;

      for (const shift of shifts) {
        // Calculate per-shift pay first to know row height
        const pr = shiftPremiums(shift, rates);
        const flags = [];
        if (pr.eveH > 0) flags.push(`EVE ${pr.eveH}h`);
        if (pr.nightH > 0) flags.push(`NGT ${pr.nightH}h`);
        if (pr.wkndH > 0) flags.push(`WKD ${pr.wkndH}h`);
        if (pr.superH > 0) flags.push('Super');
        if (shift.short_notice) flags.push('Short Notice');
        if (shift.responsibility_pay && shift.responsibility_pay !== 'none') flags.push(`Resp`);
        if (shift.specialty_premium) flags.push('Specialty');
        if (shift.preceptor) flags.push('Preceptor');
        if (shift.on_call_hours > 0) flags.push(`On-Call ${shift.on_call_hours}h`);

        const hasLoc = !!(shift.hospital || shift.unit);
        const rowH = 28; // fixed height: date(5) + time(5) + loc(4) + flags(4) + pay(5) + padding(9)
        if (y > PAGE_H - rowH - 6) { doc.addPage(); y = M + 4; }

        // Row background
        doc.setFillColor(252,253,254).setDrawColor(...COL.border).setLineWidth(0.15);
        doc.roundedRect(M, y - 2, PW, rowH, 2, 2, 'FD');

        // LEFT COLUMN: date, time, location, flags
        const isNightShift = pr.night > 0;
        const dt = new Date(shift.date+'T12:00:00');
        const dateLabel = dt.toLocaleDateString('en-CA',{month:'short',day:'numeric',weekday:'short'});

        doc.setFont('helvetica','bold').setFontSize(9).setTextColor(...COL.dark);
        doc.text(`${isNightShift ? 'N' : 'D'}  ${dateLabel}`, M + 3, y + 1);

        const typeLabel = TYPE_LABELS[shift.shift_type] || shift.shift_type;
        doc.setFont('helvetica','normal').setFontSize(8).setTextColor(...COL.dark);
        const timeStr = `${shift.start_time} - ${shift.end_time}`;
        const timeW = doc.getTextWidth(timeStr);
        doc.text(timeStr, M + 3, y + 6);

        // Type badge after time text (dynamic position to avoid overlap)
        const badgeX = M + 4 + timeW + 3;
        doc.setFillColor(235,238,242);
        doc.roundedRect(badgeX - 2, y + 3, 20, 4.5, 1.5, 1.5, 'F');
        doc.setFontSize(6.5).setTextColor(...COL.muted);
        doc.text(typeLabel, badgeX + 8, y + 6.3, { align: 'center' });

        let leftY = y + 11;
        if (hasLoc) {
          doc.setFont('helvetica','normal').setFontSize(7).setTextColor(...COL.muted);
          doc.text(safe([shift.hospital, shift.unit].filter(Boolean).join(' / ')), M + 3, leftY);
          leftY += 4.5;
        }
        if (flags.length > 0) {
          doc.setFont('helvetica','normal').setFontSize(6.5).setTextColor(...COL.muted);
          doc.text(flags.join(' | '), M + 3, leftY);
        }

        // RIGHT COLUMN: status, hours, pay breakdown (right-aligned, no overlap)
        let statusLabel, statusColor;
        const today = new Date().toISOString().slice(0,10);
        if (shift.status === 'verified') { statusLabel = 'Verified'; statusColor = [34,139,34]; }
        else if (shift.date > today) { statusLabel = 'Upcoming'; statusColor = [220,160,20]; }
        else { statusLabel = 'Pending'; statusColor = COL.accent; }

        doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(...statusColor);
        doc.text(statusLabel, M + PW - 3, y + 1, { align: 'right' });
        doc.setFont('helvetica','bold').setFontSize(8.5).setTextColor(...COL.dark);
        doc.text(`${shift.paid_hours||0}h`, M + PW - 3, y + 6, { align: 'right' });

        // Pay breakdown on its own line at the bottom of the card
        const segments = splitOvernight(shift);
        let stPay=0; const otGroups={};
        for (const seg of segments) {
          const mult = segMult(shift.shift_type, seg.date);
          if (mult > 0) {
            const base = seg.hours * wage;
            if (mult === 1.0) stPay += base;
            else { stPay += base; otGroups[mult] = (otGroups[mult]||0) + seg.hours * wage * (mult - 1); }
          }
        }
        const premTot = premSum(pr);
        const otMults = Object.keys(otGroups).map(Number).sort((a,b)=>a-b);
        const shiftGross = r2(stPay + Object.values(otGroups).reduce((s,v)=>s+v,0) + premTot);

        const payParts = [];
        if (stPay > 0) payParts.push(`ST ${fm$(stPay)}`);
        otMults.forEach(m => payParts.push(`OTx${m} ${fm$(otGroups[m])}`));
        if (premTot > 0) payParts.push(`+ Prem ${fm$(premTot)}`);
        const payText = payParts.join('  +  ') + `  =  ${fm$(shiftGross)}`;

        doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(...COL.dark);
        doc.text(payText, M + PW - 3, y + rowH - 6, { align: 'right' });

        y += rowH + 3;
      }
    }

    // ── PAY BREAKDOWN ──
    y += 6;
    if (y > PAGE_H - 100) { doc.addPage(); y = M; }

    const bd = period.breakdown || {};
    doc.setFont('helvetica','bold').setFontSize(13).setTextColor(...COL.primary);
    doc.text('Pay Period Breakdown', M, y); y += 2;
    if (wage) { doc.setFont('helvetica','normal').setFontSize(8).setTextColor(...COL.muted); doc.text(`Base wage: $${wage.toFixed(2)}/hr`, M + PW, y, { align: 'right' }); }
    y += 7;

    const drawRow = (label, value, bold, color=COL.dark, sub) => {
      const rowNeeded = sub ? 14 : 9;
      if (y > PAGE_H - rowNeeded) { doc.addPage(); y = M; }
      doc.setFont('helvetica',bold?'bold':'normal').setFontSize(9).setTextColor(...color);
      doc.text(label, M, y);
      doc.text(fm$(value), M + PW, y, { align: 'right' });
      y += 5.5;
      if (sub) {
        doc.setFont('helvetica','normal').setFontSize(7).setTextColor(...COL.muted);
        doc.text(sub, M + 2, y);
        y += 4.5;
      }
    };
    const secHdr = (label) => {
      if (y > PAGE_H - 18) { doc.addPage(); y = M; }
      doc.setFont('helvetica','bold').setFontSize(7.5).setTextColor(...COL.muted);
      doc.text(label, M, y); y += 4.5;
    };

    // Base Pay
    secHdr('BASE PAY');
    if (bd.straight_time_pay) {
      const rh = bd.regular_hours||0;
      const stWage = wage||(rh>0?bd.straight_time_pay/rh:0);
      drawRow('Straight-Time Pay', bd.straight_time_pay, false, COL.dark, `${rh}h x ${fm$(stWage)}/hr = ${fm$(bd.straight_time_pay)}`);
    }
    if (bd.overtime_pay) {
      const det = bd.overtime_detail || {};
      const parts = [];
      const labels = { overtime:'1.5x', day_off:'2x (Day Off)', work_stat:'2x (Stat)', work_super_stat:'2.5x (Super Stat)', ot_stat:'3x (OT on Stat)' };
      for (const [t,hrs] of Object.entries(det)) if (hrs>0) {
        const mult = { overtime:1.5, day_off:2, work_stat:2, work_super_stat:2.5, ot_stat:3 }[t]||0;
        const premium = r2(hrs * wage * (mult - 1));
        parts.push(`${hrs}h ${labels[t]} = ${fm$(premium)}`);
      }
      drawRow('Overtime / Stat Pay', bd.overtime_pay, false, COL.dark, parts.join(', '));
    }

    // Hourly Premiums
    const premRows = [
      ['Regular Premium', bd.regular_premium_total, bd.regular_premium_hours, rates.regular_premium],
      ['Evening Premium', bd.evening_premium_total, bd.evening_premium_hours, rates.evening],
      ['Night Premium', bd.night_premium_total, bd.night_premium_hours, rates.night],
      ['Weekend Premium', bd.weekend_premium_total, bd.weekend_premium_hours, rates.weekend],
      ['Super Shift Premium', bd.super_shift_premium_total, bd.super_shift_premium_hours, rates.super_shift],
      ['Short Notice', bd.short_notice_total, bd.short_notice_hours, rates.short_notice],
      ['Responsibility Pay', bd.responsibility_total, bd.responsibility_hours, null],
      ['Specialty Premium', bd.specialty_premium_total, bd.specialty_premium_hours, rates.specialty],
      ['Preceptor', bd.preceptor_total, bd.preceptor_hours, rates.preceptor],
    ].filter(r => r[1] > 0);
    if (premRows.length > 0) { y+=2; secHdr('HOURLY PREMIUMS');
      premRows.forEach(([l,v,hrs,r]) => {
        let sub = null;
        if (hrs > 0 && r) sub = `${hrs}h x ${fm$(r)}/hr = ${fm$(r2(hrs*r))}`;
        else if (hrs > 0 && !r && l === 'Responsibility Pay') {
          // Flat responsibility: show as "1 shift × $18.75"
          if (hrs >= 1 && hrs < 2 && (rates.responsibility_flat||0) > 0) sub = `1 shift x ${fm$(rates.responsibility_flat||0)} = ${fm$(v)}`;
          else sub = `${hrs}h x ${fm$(rates.responsibility_hourly||0)}/hr = ${fm$(v)}`;
        } else if (hrs > 0) sub = `${hrs}h`;
        drawRow(l, v, false, COL.dark, sub);
      });
    }

    // On-Call
    if (bd.on_call_total > 0) {
      y+=2; secHdr('ON-CALL');
      const hr = bd.on_call_hours||0;
      const ft = Math.min(hr,72), bt = Math.max(0,hr-72);
      const calc = [];
      if (ft>0) calc.push(`${ft}h x ${fm$(rates.on_call_first_72||7)}/hr = ${fm$(r2(ft*(rates.on_call_first_72||7)))}`);
      if (bt>0) calc.push(`${bt}h x ${fm$(rates.on_call_beyond_72||7.5)}/hr = ${fm$(r2(bt*(rates.on_call_beyond_72||7.5)))}`);
      drawRow('On-Call Pay', bd.on_call_total, false, COL.dark, calc.join(', '));
    }

    // Allowances & Differentials
    if (bd.allowance_total > 0 || bd.qualification_total > 0) {
      y+=2; secHdr('MONTHLY ALLOWANCES & DIFFERENTIALS');
      if (bd.allowance_total > 0) {
        const mo = bd.allowance_monthly||0;
        drawRow('Allowances (per period)', bd.allowance_total, false, COL.dark, mo > 0 ? `${fm$(mo)}/mo (paid in full)` : null);
      }
      if (bd.qualification_total > 0) {
        const qh = bd.qualification_hourly||0, rh = bd.regular_hours||0;
        drawRow('Differentials', bd.qualification_total, false, COL.dark, `${rh}h x ${fm$(qh)}/hr = ${fm$(bd.qualification_total)}`);
      }
    }

    // Union Dues
    const unionDues = bd.union_dues || 0;
    if (unionDues > 0) {
      y += 2; secHdr('DEDUCTIONS');
      drawRow('Union Dues', -unionDues, false, COL.accent, `${fm$(bd.straight_time_pay||0)} x 2.0% = ${fm$(unionDues)}`);
    }

    // Gross Pay
    y += 4;
    if (y > PAGE_H - 18) { doc.addPage(); y = M; }
    doc.setDrawColor(...COL.primary).setLineWidth(0.6);
    doc.line(M, y, M + PW, y); y += 7;
    doc.setFont('helvetica','bold').setFontSize(13).setTextColor(...COL.primary);
    doc.text('Gross Pay', M, y);
    doc.text(fm$(bd.gross_pay||0), M + PW, y, { align: 'right' });
    y += 12;

    // ── STATUTORY DEDUCTIONS ──
    const vd = period.verified_deductions || {};
    const est = estDed(bd, settings.tax_settings||{});
    const hasV = vd && Object.keys(vd).some(k=>['cpp','cpp2','ei','federal_tax','provincial_tax'].includes(k)&&(vd[k]||0)>0);

    // Merge verified over estimated
    const fd = {
      cpp: vd.cpp != null ? vd.cpp : est?.cpp || 0,
      cpp2: vd.cpp2 != null ? vd.cpp2 : est?.cpp2 || 0,
      ei: vd.ei != null ? vd.ei : est?.ei || 0,
      federal_tax: vd.federal_tax != null ? vd.federal_tax : est?.fed || 0,
      provincial_tax: vd.provincial_tax != null ? vd.provincial_tax : est?.prov || 0,
      union_dues: vd.union_dues != null ? vd.union_dues : unionDues,
      other: vd.other_deductions || 0,
    };

    if (y > PAGE_H - 50) { doc.addPage(); y = M; }
    const dedLabel = hasV ? 'STATUTORY DEDUCTIONS (VERIFIED FROM PAY STUB)' : 'ESTIMATED STATUTORY DEDUCTIONS';
    secHdr(dedLabel);

    const dRows = [
      ['CPP', fd.cpp, hasV ? null : `(5.95% on pensionable earnings up to $74,600)`],
      ['CPP2', fd.cpp2, fd.cpp2 > 0 && !hasV ? `(4.0% on earnings $74,600-$85,000)` : null],
      ['EI', fd.ei, hasV ? null : `(1.63% on insurable earnings up to $68,900)`],
      ['Federal Income Tax', fd.federal_tax, hasV ? null : `Gross ${fm$(bd.gross_pay||0)} x ${(mRate(FED_B, settings.tax_settings?.annual_federal_income||0)*100).toFixed(1)}% rate`],
      ['Provincial Income Tax', fd.provincial_tax, hasV ? null : `Gross ${fm$(bd.gross_pay||0)} x ${(mRate(BC_B, settings.tax_settings?.annual_provincial_income||0)*100).toFixed(1)}% rate`],
      ['Union Dues', fd.union_dues, hasV ? null : `${fm$(bd.straight_time_pay||0)} x 2.0%`],
    ];
    if (fd.other > 0) dRows.push([vd.other_label ? safe(vd.other_label) : 'Other Deductions', fd.other]);
    const activeDRows = dRows.filter(r=>r[1]>0);

    if (activeDRows.length > 0) {
      activeDRows.forEach(([l,v,sub]) => drawRow(l, -v, false, COL.accent, sub));
      const totalDed = activeDRows.reduce((s,r)=>s+r[1],0);
      const netPay = r2((bd.gross_pay||0)-totalDed);
      y += 4;
      doc.setDrawColor(...COL.primary).setLineWidth(0.5);
      doc.line(M, y, M + PW, y); y += 7;
      doc.setFont('helvetica','bold').setFontSize(12).setTextColor(...COL.primary);
      doc.text(hasV ? 'Verified Net Pay' : 'Estimated Net Pay', M, y);
      doc.text(fm$(netPay), M + PW, y, { align: 'right' });

      // Extra info
      y += 8;
      doc.setFont('helvetica','normal').setFontSize(6.5).setTextColor(...COL.muted);
      doc.text('* Income tax estimates use marginal rate at configured annual income. Actual withholding depends on TD1 credits.', M, y);
    } else {
      doc.setFont('helvetica','normal').setFontSize(8).setTextColor(...COL.muted);
      doc.text('Insufficient income data to estimate deductions. Add annual income in Settings.', M, y);
    }

    // ── Footer ──
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica','normal').setFontSize(7).setTextColor(...COL.muted);
      doc.text(`NursePayCheck  |  Page ${i} of ${totalPages}  |  ${genDate}`, M + PW/2, PAGE_H - 7, { align: 'center' });
    }

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: { 'Content-Type':'application/pdf', 'Content-Disposition':`attachment; filename="pay-period-${period.start_date}.pdf"` },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});