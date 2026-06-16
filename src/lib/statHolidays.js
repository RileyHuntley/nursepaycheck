/**
 * BC Statutory Holidays and VCH Pay Period Dates
 */

// Super stats = Christmas Day, Labour Day, Good Friday (per NBA CBA)
const SUPER_STATS = [
  // 2026
  '2026-04-03', // Good Friday
  '2026-09-07', // Labour Day
  '2026-12-25', // Christmas Day
  // 2027
  '2027-03-26', // Good Friday
  '2027-09-06', // Labour Day
  '2027-12-25', // Christmas Day
];

// All BC stat holidays (excluding super stats, which are also stats)
const REGULAR_STATS = [
  // 2026
  '2026-01-01', // New Year's Day
  '2026-02-16', // Family Day
  '2026-04-06', // Easter Monday
  '2026-05-18', // Victoria Day
  '2026-07-01', // Canada Day
  '2026-08-03', // BC Day
  '2026-09-30', // National Day for Truth and Reconciliation
  '2026-10-12', // Thanksgiving Day
  '2026-11-11', // Remembrance Day
  '2026-12-26', // Boxing Day
  // 2027
  '2027-01-01', // New Year's Day
  '2027-02-15', // Family Day
  '2027-05-24', // Victoria Day
  '2027-07-01', // Canada Day
  '2027-08-02', // BC Day
  '2027-09-30', // National Day for Truth and Reconciliation
  '2027-10-11', // Thanksgiving Day
  '2027-11-11', // Remembrance Day
  '2027-12-26', // Boxing Day
];

export function isSuperStat(dateStr) {
  return SUPER_STATS.includes(dateStr);
}

export function isRegularStat(dateStr) {
  return REGULAR_STATS.includes(dateStr) || SUPER_STATS.includes(dateStr);
}

export function getStatType(dateStr) {
  if (SUPER_STATS.includes(dateStr)) return 'super_stat';
  if (REGULAR_STATS.includes(dateStr)) return 'stat';
  return null;
}

export function getStatName(dateStr) {
  const all = {
    '2026-01-01': "New Year's Day",
    '2026-02-16': 'Family Day',
    '2026-04-03': 'Good Friday',
    '2026-04-06': 'Easter Monday',
    '2026-05-18': 'Victoria Day',
    '2026-07-01': 'Canada Day',
    '2026-08-03': 'BC Day',
    '2026-09-07': 'Labour Day',
    '2026-09-30': 'Natl Day for Truth & Reconciliation',
    '2026-10-12': 'Thanksgiving Day',
    '2026-11-11': 'Remembrance Day',
    '2026-12-25': 'Christmas Day',
    '2026-12-26': 'Boxing Day',
    '2027-01-01': "New Year's Day",
    '2027-02-15': 'Family Day',
    '2027-03-26': 'Good Friday',
    '2027-05-24': 'Victoria Day',
    '2027-07-01': 'Canada Day',
    '2027-08-02': 'BC Day',
    '2027-09-06': 'Labour Day',
    '2027-09-30': 'Natl Day for Truth & Reconciliation',
    '2027-10-11': 'Thanksgiving Day',
    '2027-11-11': 'Remembrance Day',
    '2027-12-25': 'Christmas Day',
    '2027-12-26': 'Boxing Day',
  };
  return all[dateStr] || null;
}

/**
 * Get the VCH pay date for a given date string (returns pay_date if dateStr is a pay_date)
 */
export function getPayDate(dateStr) {
  return VCH_PAY_PERIODS_2026.find(p => p.pay_date === dateStr) || null;
}

/**
 * Get the VCH pay period number (e.g. "2613") for a pay period by matching its start date
 */
export function getVCHPeriodNumber(startDate) {
  const match = VCH_PAY_PERIODS_2026.find(p => p.start === startDate);
  return match ? match.id : null;
}

// VCH 2026 pay periods (from official calendar)
export const VCH_PAY_PERIODS_2026 = [
  { id: '2601', start: '2025-12-19', end: '2026-01-01', pay_date: '2026-01-09' },
  { id: '2602', start: '2026-01-02', end: '2026-01-15', pay_date: '2026-01-23' },
  { id: '2603', start: '2026-01-16', end: '2026-01-29', pay_date: '2026-02-06' },
  { id: '2604', start: '2026-01-30', end: '2026-02-12', pay_date: '2026-02-20' },
  { id: '2605', start: '2026-02-13', end: '2026-02-26', pay_date: '2026-03-06' },
  { id: '2606', start: '2026-02-27', end: '2026-03-12', pay_date: '2026-03-20' },
  { id: '2607', start: '2026-03-13', end: '2026-03-26', pay_date: '2026-04-02' },
  { id: '2608', start: '2026-03-27', end: '2026-04-09', pay_date: '2026-04-17' },
  { id: '2609', start: '2026-04-10', end: '2026-04-23', pay_date: '2026-05-01' },
  { id: '2610', start: '2026-04-24', end: '2026-05-07', pay_date: '2026-05-15' },
  { id: '2611', start: '2026-05-08', end: '2026-05-21', pay_date: '2026-05-29' },
  { id: '2612', start: '2026-05-22', end: '2026-06-04', pay_date: '2026-06-12' },
  { id: '2613', start: '2026-06-05', end: '2026-06-18', pay_date: '2026-06-26' },
  { id: '2614', start: '2026-06-19', end: '2026-07-02', pay_date: '2026-07-10' },
  { id: '2615', start: '2026-07-03', end: '2026-07-16', pay_date: '2026-07-24' },
  { id: '2616', start: '2026-07-17', end: '2026-07-30', pay_date: '2026-08-07' },
  { id: '2617', start: '2026-07-31', end: '2026-08-13', pay_date: '2026-08-21' },
  { id: '2618', start: '2026-08-14', end: '2026-08-27', pay_date: '2026-09-04' },
  { id: '2619', start: '2026-08-28', end: '2026-09-10', pay_date: '2026-09-18' },
  { id: '2620', start: '2026-09-11', end: '2026-09-24', pay_date: '2026-10-02' },
  { id: '2621', start: '2026-09-25', end: '2026-10-08', pay_date: '2026-10-16' },
  { id: '2622', start: '2026-10-09', end: '2026-10-22', pay_date: '2026-10-30' },
  { id: '2623', start: '2026-10-23', end: '2026-11-05', pay_date: '2026-11-13' },
  { id: '2624', start: '2026-11-06', end: '2026-11-19', pay_date: '2026-11-27' },
  { id: '2625', start: '2026-11-20', end: '2026-12-03', pay_date: '2026-12-11' },
  { id: '2626', start: '2026-12-04', end: '2026-12-17', pay_date: '2026-12-24' },
  { id: '2701', start: '2026-12-18', end: '2026-12-31', pay_date: '2027-01-08' },
];

/**
 * Get the VCH pay period that contains a given date
 */
export function getVCHPayPeriod(dateStr) {
  return VCH_PAY_PERIODS_2026.find(p => dateStr >= p.start && dateStr <= p.end) || null;
}

/**
 * Get current VCH pay period
 */
export function getCurrentVCHPayPeriod() {
  const today = new Date().toISOString().split('T')[0];
  return getVCHPayPeriod(today);
}