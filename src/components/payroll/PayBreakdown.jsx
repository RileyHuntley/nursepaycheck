import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { estimateTaxes, estimateStatutoryDeductions } from '@/lib/taxCalculator';

const PREMIUM_INFO = {
  evening: {
    article: 'Article 28.01',
    title: 'Evening Shift Premium',
    description: 'Paid for the entire shift when more than one-half of the hours worked fall between 15:30 – 23:30.\n\nNurses who work an extended hour shift rotation shall only be paid the evening shift premium for all hours worked between 15:30 – 23:30.',
  },
  night: {
    article: 'Article 28.01',
    title: 'Night Shift Premium',
    description: 'Paid for the entire shift when more than one-half of the hours worked fall between 23:30 – 07:30.\n\nNurses who work an extended hour shift rotation shall only be paid the night shift premium for all hours worked between 23:30 – 07:30.',
  },
  weekend: {
    article: 'Article 28.02',
    title: 'Weekend Shift Premium',
    description: 'Paid for each hour worked between 23:00 Friday and 23:00 Sunday. This premium does not apply to certain members under NBA Article 25.07(H) Flexible Work Schedules.',
  },
  super_shift: {
    article: 'Article 28.03',
    title: 'Super Shift Premium',
    description: 'Paid to nurses who work Friday and Saturday nights — typically the most difficult to fill shifts — on all hours worked between:\n(a) 23:30 Friday – 07:30 Saturday; and\n(b) 23:30 Saturday – 07:30 Sunday.',
  },
  short_notice: {
    article: 'Article 28.04',
    title: 'Short Notice Premium',
    description: 'Paid to incentivize nurses to pick up short-call straight-time vacancies within 24 hours prior to the commencement of the shift, on all hours worked.',
  },
  regular_premium: {
    article: 'Article 28.05',
    title: 'Regular Premium',
    description: 'Paid out on all straight-time hours worked by regular employees (excluding overtime) to incentivize nurses taking regular positions.',
  },
  on_call: {
    article: 'Article 29.03(a)',
    title: 'On-Call Premium',
    description: 'A nurse designated as on-call shall be paid a premium of $7.00/hr for the first 72 hours on-call in a calendar month.\n\nThey shall then receive $7.50/hr for all on-call hours beyond 72 hours within the calendar month.',
  },
  responsibility: {
    article: 'Article 30',
    title: 'Responsibility Pay',
    description: 'Normally paid to level 3 nurses placed in a position for two or more hours in which they have the duty and responsibility to supervise or direct the ward/unit, see that matters are organized, and make effective operational decisions.\n\nLevel 1 Nurses may also be designated "in charge" duties by the Employer. In-charge duties usually need to be "over and above" what a Level 1/3 nurse would normally do.\n\nMembers cannot receive both the hourly ($2.50/hr) and flat ($18.75/shift) premiums on any given shift.',
  },
  preceptor: {
    article: 'Appendix GG',
    title: 'Preceptor Premium',
    description: 'A preceptor is a nurse designated by the Employer based on educational and regulatory requirements to provide supervision for a Preceptee.\n\nThe preceptor premium is paid to nurses for the length of the entire shift they are designated a preceptor.',
  },
  allowances: {
    article: 'Articles 54 & 57.06',
    title: 'Monthly Allowances',
    description: 'Isolation Allowance (Article 54): $150/month lump-sum for nurses working in communities identified in Article 54. Pro-rated for Part-Time & Casual nurses.\n\nBusiness Allowance (Article 57.06): $150/month for all regular nurses employed in community-based services. Does not include clinic-type services aligned with acute care such as hospital outpatient clinics.\n\nPaid per pay period as: (monthly total × 12) ÷ 26 pay periods.',
  },
  qualification: {
    article: 'Article 53',
    title: 'Qualification Differentials',
    description: 'Special Clinical Preparation (Art. 53.01): $50/month\nCHA/BCIT Courses (Art. 53.02): $25/month\nRPN Dual Registration (Art. 53.03): $50/month\nUniversity Preparation (Art. 53.04): $25/month\nBaccalaureate Degree (Art. 53.05): $100/month\nMaster\'s Degree (Art. 53.06): $125/month\n\nOnly regular nurses qualify. The combined yearly amount is divided by 1950 hours/year to produce an hourly rate, then multiplied by all regular hours paid in the pay period.',
  },
  straight_time: {
    article: 'NBA CBA',
    title: 'Straight-Time Pay',
    description: 'Base hourly wage paid for all regular straight-time hours worked, including regular shifts, ISN, vacation, sick leave, PDO/PST, and other paid leaves at a 1.0× multiplier.',
  },
  overtime: {
    article: 'NBA CBA',
    title: 'Overtime & Stat Pay',
    description: 'Wage premium for shifts worked at elevated multipliers:\n• Overtime Shift: 1.5×\n• Working Day Off: 2.0×\n• Work Stat Holiday: 2.0×\n• Work Super Stat: 2.5×\n• OT Shift on Stat: 3.0×',
  },
  union_dues: {
    article: 'BCNU/NBA',
    title: 'Union Dues',
    description: 'Union dues are deducted at 2% of straight-time pay (base wage × regular hours). Overtime, premiums, allowances, and qualifications are excluded from the dues calculation.',
  },
  est_taxes: {
    article: 'CRA / BC Gov',
    title: 'Estimated Taxes',
    description: 'A rough estimate of provincial (BC) and federal income tax based on your marginal tax rate at your configured annual income threshold. Rates are applied to gross pay for this period. This is an estimate only — actual withholding depends on TD1 credits, deductions, and employer calculations.',
  },
  cpp: {
    article: 'CRA',
    title: 'CPP Contribution',
    description: 'Canada Pension Plan contributions at 5.95% on pensionable earnings between $3,500 and $74,600 (max $4,230.45/yr). Pro-rated per pay period based on your annual income estimate.',
  },
  cpp2: {
    article: 'CRA',
    title: 'CPP2 Contribution',
    description: 'Second CPP tier at 4.0% on earnings between $74,600 and $85,000 (max $416.00/yr). Only applicable if annual income exceeds $74,600.',
  },
  ei: {
    article: 'CRA',
    title: 'EI Premium',
    description: 'Employment Insurance premiums at 1.63% on insurable earnings up to $68,900 (max $1,123.07/yr). Pro-rated per pay period based on your annual income estimate.',
  },
};

function InfoPopover({ info, onClose }) {
  return (
    <div className="absolute z-50 left-0 top-6 w-72 bg-popover border border-border rounded-lg shadow-lg p-3 text-left" onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <p className="text-xs font-semibold text-foreground leading-tight">{info.title}</p>
          <p className="text-[10px] text-primary font-mono mt-0.5">{info.article}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{info.description}</p>
    </div>
  );
}

function LineItem({ label, amount, sublabel, negative, infoKey, openInfo, onToggleInfo }) {
  if (amount === 0 || amount == null) return null;
  const info = infoKey ? PREMIUM_INFO[infoKey] : null;
  const isOpen = openInfo === infoKey;

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm text-foreground">{label}</span>
        {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
        {info && (
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleInfo(isOpen ? null : infoKey); }}
              className={`p-0.5 rounded transition-colors ${isOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            {isOpen && <InfoPopover info={info} onClose={() => onToggleInfo(null)} />}
          </div>
        )}
      </div>
      <span className={`text-sm font-mono font-medium flex-shrink-0 ml-2 ${negative ? 'text-destructive' : 'text-foreground'}`}>
        {negative ? '−' : ''}${amount.toFixed(2)}
      </span>
    </div>
  );
}

function SectionHeader({ title }) {
  return <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3 pb-1">{title}</h4>;
}

export default function PayBreakdown({ breakdown, wage, title = 'Pay Period Breakdown', taxSettings }) {
  const [openInfo, setOpenInfo] = useState(null);
  if (!breakdown) return null;

  const toggle = (key) => setOpenInfo(prev => prev === key ? null : key);

  const annualIncome = taxSettings
    ? (taxSettings.annual_federal_income || taxSettings.annual_provincial_income || 0)
    : 0;

  const taxes = annualIncome > 0
    ? estimateTaxes(
        breakdown.gross_pay,
        taxSettings.annual_provincial_income || 0,
        taxSettings.annual_federal_income || 0,
      )
    : null;
  const hasTaxes = taxes && taxes.total > 0;

  const statutory = annualIncome > 0
    ? estimateStatutoryDeductions(breakdown.gross_pay, annualIncome)
    : null;
  const hasStatutory = statutory && statutory.total > 0;

  const netPay = breakdown.gross_pay
    - (breakdown.union_dues || 0)
    - (hasTaxes ? taxes.total : 0)
    - (hasStatutory ? statutory.total : 0);

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-1" onClick={() => setOpenInfo(null)}>
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="text-base font-display font-semibold text-foreground">{title}</h3>
        {wage && <span className="text-xs text-muted-foreground">Base wage: ${wage.toFixed(2)}/hr</span>}
      </div>

      <SectionHeader title="Base Pay" />
      <LineItem
        label="Straight-Time Pay"
        amount={breakdown.straight_time_pay}
        sublabel={`${breakdown.regular_hours || 0}h @ $${(wage || breakdown.straight_time_pay / (breakdown.regular_hours || 1)).toFixed(2)}/hr`}
      />
      <LineItem
        label="Overtime/Stat Pay"
        amount={breakdown.overtime_pay}
        sublabel={(() => {
          const det = breakdown.overtime_detail;
          if (!det) return null;
          const parts = [];
          const labels = { overtime: '1.5× (OT)', day_off: '2× (Day Off)', work_stat: '2× (Stat)', work_super_stat: '2.5× (Super Stat)', ot_stat: '3× (OT on Stat)' };
          for (const [type, hrs] of Object.entries(det)) {
            if (hrs > 0) parts.push(`${hrs}h @ ${labels[type] || type}`);
          }
          return parts.length > 0 ? parts.join(', ') : null;
        })()}
      />

      <SectionHeader title="Hourly Premiums" />
      <LineItem label="Regular Premium" amount={breakdown.regular_premium_total} sublabel={breakdown.regular_premium_hours > 0 ? `${breakdown.regular_premium_hours}h × $2.15/hr` : null} infoKey="regular_premium" openInfo={openInfo} onToggleInfo={toggle} />
      <LineItem label="Evening Premium" amount={breakdown.evening_premium_total} sublabel={breakdown.evening_premium_hours > 0 ? `${breakdown.evening_premium_hours}h × $1.40/hr` : null} infoKey="evening" openInfo={openInfo} onToggleInfo={toggle} />
      <LineItem label="Night Premium" amount={breakdown.night_premium_total} sublabel={breakdown.night_premium_hours > 0 ? `${breakdown.night_premium_hours}h × $5.00/hr` : null} infoKey="night" openInfo={openInfo} onToggleInfo={toggle} />
      <LineItem label="Weekend Premium" amount={breakdown.weekend_premium_total} sublabel={breakdown.weekend_premium_hours > 0 ? `${breakdown.weekend_premium_hours}h × $3.50/hr` : null} infoKey="weekend" openInfo={openInfo} onToggleInfo={toggle} />
      <LineItem label="Super Shift Premium" amount={breakdown.super_shift_premium_total} sublabel={breakdown.super_shift_premium_hours > 0 ? `${breakdown.super_shift_premium_hours}h × $1.85/hr` : null} infoKey="super_shift" openInfo={openInfo} onToggleInfo={toggle} />
      <LineItem label="Short Notice" amount={breakdown.short_notice_total} sublabel={breakdown.short_notice_hours > 0 ? `${breakdown.short_notice_hours}h × $2.00/hr` : null} infoKey="short_notice" openInfo={openInfo} onToggleInfo={toggle} />
      <LineItem label="Responsibility Pay" amount={breakdown.responsibility_total} sublabel={breakdown.responsibility_hours > 0 ? (breakdown.responsibility_hours >= 1 && breakdown.responsibility_hours < 2 ? '1 shift × $18.75' : `${breakdown.responsibility_hours}h × $2.50/hr`) : null} infoKey="responsibility" openInfo={openInfo} onToggleInfo={toggle} />
      <LineItem label="Preceptor" amount={breakdown.preceptor_total} sublabel={breakdown.preceptor_hours > 0 ? `${breakdown.preceptor_hours}h × $1.50/hr` : null} infoKey="preceptor" openInfo={openInfo} onToggleInfo={toggle} />
      <LineItem label="On-Call Pay" amount={breakdown.on_call_total} sublabel={breakdown.on_call_hours ? `${breakdown.on_call_hours}h total` : null} infoKey="on_call" openInfo={openInfo} onToggleInfo={toggle} />

      <SectionHeader title="Monthly Allowances & Qualifications" />
      <LineItem label="Allowances (per period)" amount={breakdown.allowance_total} sublabel={`$${breakdown.allowance_monthly}/mo prorated`} infoKey="allowances" openInfo={openInfo} onToggleInfo={toggle} />
      <LineItem label="Qualification Diff." amount={breakdown.qualification_total} sublabel={`$${breakdown.qualification_hourly}/hr × ${breakdown.regular_hours || 0} reg hrs`} infoKey="qualification" openInfo={openInfo} onToggleInfo={toggle} />

      <SectionHeader title="Deductions" />
      <LineItem label="Union Dues (2% of straight-time)" amount={breakdown.union_dues} negative infoKey="union_dues" openInfo={openInfo} onToggleInfo={toggle} />
      {hasStatutory && (
        <>
          <LineItem label="CPP Contribution" amount={statutory.cpp} negative infoKey="cpp" openInfo={openInfo} onToggleInfo={toggle} />
          {statutory.cpp2 > 0 && (
            <LineItem label="CPP2 Contribution" amount={statutory.cpp2} negative infoKey="cpp2" openInfo={openInfo} onToggleInfo={toggle} />
          )}
          <LineItem label="EI Premium" amount={statutory.ei} negative infoKey="ei" openInfo={openInfo} onToggleInfo={toggle} />
        </>
      )}
      {hasTaxes && (
        <>
          <LineItem label="Est. BC Provincial Tax" amount={taxes.provincial} negative infoKey="est_taxes" openInfo={openInfo} onToggleInfo={toggle} />
          <LineItem label="Est. Federal Tax" amount={taxes.federal} negative infoKey="est_taxes" openInfo={openInfo} onToggleInfo={toggle} />
        </>
      )}

      <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
        <span className="text-sm font-semibold text-foreground">Expected Gross Pay</span>
        <span className="text-base font-mono font-semibold text-foreground">${breakdown.gross_pay.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-primary/30">
        <span className="text-base font-display font-bold text-foreground">Estimated Net Pay</span>
        <span className="text-xl font-mono font-bold text-primary">${netPay.toFixed(2)}</span>
      </div>
    </div>
  );
}