/**
 * BC Statutory Holidays and VCH Pay Period Dates
 */

// Super stats = Christmas Day, Labour Day, Good Friday (per NBA CBA)
const SUPER_STATS = [
// 2020
  '2020-04-10', // Good Friday
  '2020-09-07', // Labour Day
  '2020-12-25', // Christmas Day
// 2021
  '2021-04-02', // Good Friday
  '2021-09-06', // Labour Day
  '2021-12-25', // Christmas Day
// 2022
  '2022-04-15', // Good Friday
  '2022-09-05', // Labour Day
  '2022-12-25', // Christmas Day
// 2023
  '2023-04-07', // Good Friday
  '2023-09-04', // Labour Day
  '2023-12-25', // Christmas Day
// 2024
  '2024-03-29', // Good Friday
  '2024-09-02', // Labour Day
  '2024-12-25', // Christmas Day
  // 2025
  '2025-04-18', // Good Friday
  '2025-09-01', // Labour Day
  '2025-12-25', // Christmas Day
  // 2026
  '2026-04-03', // Good Friday
  '2026-09-07', // Labour Day
  '2026-12-25', // Christmas Day
  // 2027
  '2027-03-26', // Good Friday
  '2027-09-06', // Labour Day
  '2027-12-25', // Christmas Day
  // 2028
  '2028-04-14', // Good Friday
  '2028-09-04', // Labour Day
  '2028-12-25', // Christmas Day
  // 2029
  '2029-03-29', // Good Friday
  '2029-09-03', // Labour Day
  '2029-12-25', // Christmas Day
// 2030
  '2030-04-19', // Good Friday
  '2030-09-02', // Labour Day
  '2030-12-25', // Christmas Day
];

// All BC stat holidays (excluding super stats, which are also stats)
const REGULAR_STATS = [
// 2020
  '2020-01-01', // New Year's Day
  '2020-02-17', // Family Day
  '2020-04-13', // Easter Monday
  '2020-05-18', // Victoria Day
  '2020-07-01', // Canada Day
  '2020-08-03', // BC Day
  '2020-10-12', // Thanksgiving Day
  '2020-11-11', // Remembrance Day
  '2020-12-26', // Boxing Day
// 2021
  '2021-01-01', // New Year's Day
  '2021-02-15', // Family Day
  '2021-04-05', // Easter Monday
  '2021-05-24', // Victoria Day
  '2021-07-01', // Canada Day
  '2021-08-02', // BC Day
  '2021-10-11', // Thanksgiving Day
  '2021-11-11', // Remembrance Day
  '2021-12-26', // Boxing Day
// 2022
  '2022-01-01', // New Year's Day
  '2022-02-21', // Family Day
  '2022-04-18', // Easter Monday
  '2022-05-23', // Victoria Day
  '2022-07-01', // Canada Day
  '2022-08-01', // BC Day
  '2022-10-10', // Thanksgiving Day
  '2022-11-11', // Remembrance Day
  '2022-12-26', // Boxing Day
// 2023
  '2023-01-01', // New Year's Day
  '2023-02-20', // Family Day
  '2023-04-10', // Easter Monday
  '2023-05-22', // Victoria Day
  '2023-07-01', // Canada Day
  '2023-08-07', // BC Day
  '2023-09-30', // National Day for Truth and Reconciliation
  '2023-10-09', // Thanksgiving Day
  '2023-11-11', // Remembrance Day
  '2023-12-26', // Boxing Day
// 2024
  '2024-01-01', // New Year's Day
  '2024-02-19', // Family Day
  '2024-04-01', // Easter Monday
  '2024-05-20', // Victoria Day
  '2024-07-01', // Canada Day
  '2024-08-05', // BC Day
  '2024-09-30', // National Day for Truth and Reconciliation
  '2024-10-14', // Thanksgiving Day
  '2024-11-11', // Remembrance Day
  '2024-12-26', // Boxing Day
// 2025
  '2025-01-01', // New Year's Day
  '2025-02-17', // Family Day
  '2025-04-21', // Easter Monday
  '2025-05-19', // Victoria Day
  '2025-07-01', // Canada Day
  '2025-08-04', // BC Day
  '2025-09-30', // National Day for Truth and Reconciliation
  '2025-10-13', // Thanksgiving Day
  '2025-11-11', // Remembrance Day
  '2025-12-26', // Boxing Day
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
  '2027-03-29', // Easter Monday
  '2027-05-24', // Victoria Day
  '2027-07-01', // Canada Day
  '2027-08-02', // BC Day
  '2027-09-30', // National Day for Truth and Reconciliation
  '2027-10-11', // Thanksgiving Day
  '2027-11-11', // Remembrance Day
  '2027-12-26', // Boxing Day
  // 2028
  '2028-01-01', // New Year's Day
  '2028-02-21', // Family Day
  '2028-04-17', // Easter Monday
  '2028-05-22', // Victoria Day
  '2028-07-01', // Canada Day
  '2028-08-07', // BC Day
  '2028-09-30', // National Day for Truth and Reconciliation
  '2028-10-09', // Thanksgiving Day
  '2028-11-11', // Remembrance Day
  '2028-12-26', // Boxing Day
// 2029
  '2029-01-01', // New Year's Day
  '2029-02-19', // Family Day
  '2029-04-02', // Easter Monday
  '2029-05-21', // Victoria Day
  '2029-07-01', // Canada Day
  '2029-08-06', // BC Day
  '2029-09-30', // National Day for Truth and Reconciliation
  '2029-10-08', // Thanksgiving Day
  '2029-11-11', // Remembrance Day
  '2029-12-26', // Boxing Day
// 2030
  '2030-01-01', // New Year's Day
  '2030-02-18', // Family Day
  '2030-04-22', // Easter Monday
  '2030-05-20', // Victoria Day
  '2030-07-01', // Canada Day
  '2030-08-05', // BC Day
  '2030-09-30', // National Day for Truth and Reconciliation
  '2030-10-14', // Thanksgiving Day
  '2030-11-11', // Remembrance Day
  '2030-12-26', // Boxing Day
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
    // 2020
    '2020-01-01': "New Year's Day",
    '2020-02-17': 'Family Day',
    '2020-04-10': 'Good Friday',
    '2020-04-13': 'Easter Monday',
    '2020-05-18': 'Victoria Day',
    '2020-07-01': 'Canada Day',
    '2020-08-03': 'BC Day',
    '2020-09-07': 'Labour Day',
    '2020-10-12': 'Thanksgiving Day',
    '2020-11-11': 'Remembrance Day',
    '2020-12-25': 'Christmas Day',
    '2020-12-26': 'Boxing Day',
    // 2021
    '2021-01-01': "New Year's Day",
    '2021-02-15': 'Family Day',
    '2021-04-02': 'Good Friday',
    '2021-04-05': 'Easter Monday',
    '2021-05-24': 'Victoria Day',
    '2021-07-01': 'Canada Day',
    '2021-08-02': 'BC Day',
    '2021-09-06': 'Labour Day',
    '2021-10-11': 'Thanksgiving Day',
    '2021-11-11': 'Remembrance Day',
    '2021-12-25': 'Christmas Day',
    '2021-12-26': 'Boxing Day',
    // 2022
    '2022-01-01': "New Year's Day",
    '2022-02-21': 'Family Day',
    '2022-04-15': 'Good Friday',
    '2022-04-18': 'Easter Monday',
    '2022-05-23': 'Victoria Day',
    '2022-07-01': 'Canada Day',
    '2022-08-01': 'BC Day',
    '2022-09-05': 'Labour Day',
    '2022-10-10': 'Thanksgiving Day',
    '2022-11-11': 'Remembrance Day',
    '2022-12-25': 'Christmas Day',
    '2022-12-26': 'Boxing Day',
    // 2023
    '2023-01-01': "New Year's Day",
    '2023-02-20': 'Family Day',
    '2023-04-07': 'Good Friday',
    '2023-04-10': 'Easter Monday',
    '2023-05-22': 'Victoria Day',
    '2023-07-01': 'Canada Day',
    '2023-08-07': 'BC Day',
    '2023-09-04': 'Labour Day',
    '2023-09-30': 'Natl Day for Truth & Reconciliation',
    '2023-10-09': 'Thanksgiving Day',
    '2023-11-11': 'Remembrance Day',
    '2023-12-25': 'Christmas Day',
    '2023-12-26': 'Boxing Day',
    // 2024
    '2024-01-01': "New Year's Day",
    '2024-02-19': 'Family Day',
    '2024-03-29': 'Good Friday',
    '2024-04-01': 'Easter Monday',
    '2024-05-20': 'Victoria Day',
    '2024-07-01': 'Canada Day',
    '2024-08-05': 'BC Day',
    '2024-09-02': 'Labour Day',
    '2024-09-30': 'Natl Day for Truth & Reconciliation',
    '2024-10-14': 'Thanksgiving Day',
    '2024-11-11': 'Remembrance Day',
    '2024-12-25': 'Christmas Day',
    '2024-12-26': 'Boxing Day',
    // 2025
    '2025-01-01': "New Year's Day",
    '2025-02-17': 'Family Day',
    '2025-04-18': 'Good Friday',
    '2025-04-21': 'Easter Monday',
    '2025-05-19': 'Victoria Day',
    '2025-07-01': 'Canada Day',
    '2025-08-04': 'BC Day',
    '2025-09-01': 'Labour Day',
    '2025-09-30': 'Natl Day for Truth & Reconciliation',
    '2025-10-13': 'Thanksgiving Day',
    '2025-11-11': 'Remembrance Day',
    '2025-12-25': 'Christmas Day',
    '2025-12-26': 'Boxing Day',
    // 2026
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
    // 2027
    '2027-01-01': "New Year's Day",
    '2027-02-15': 'Family Day',
    '2027-03-26': 'Good Friday',
    '2027-03-29': 'Easter Monday',
    '2027-05-24': 'Victoria Day',
    '2027-07-01': 'Canada Day',
    '2027-08-02': 'BC Day',
    '2027-09-06': 'Labour Day',
    '2027-09-30': 'Natl Day for Truth & Reconciliation',
    '2027-10-11': 'Thanksgiving Day',
    '2027-11-11': 'Remembrance Day',
    '2027-12-25': 'Christmas Day',
    '2027-12-26': 'Boxing Day',
    // 2028
    '2028-01-01': "New Year's Day",
    '2028-02-21': 'Family Day',
    '2028-04-14': 'Good Friday',
    '2028-04-17': 'Easter Monday',
    '2028-05-22': 'Victoria Day',
    '2028-07-01': 'Canada Day',
    '2028-08-07': 'BC Day',
    '2028-09-04': 'Labour Day',
    '2028-09-30': 'Natl Day for Truth & Reconciliation',
    '2028-10-09': 'Thanksgiving Day',
    '2028-11-11': 'Remembrance Day',
    '2028-12-25': 'Christmas Day',
    '2028-12-26': 'Boxing Day',
    // 2029
    '2029-01-01': "New Year's Day",
    '2029-02-19': 'Family Day',
    '2029-03-29': 'Good Friday',
    '2029-04-02': 'Easter Monday',
    '2029-05-21': 'Victoria Day',
    '2029-07-01': 'Canada Day',
    '2029-08-06': 'BC Day',
    '2029-09-03': 'Labour Day',
    '2029-09-30': 'Natl Day for Truth & Reconciliation',
    '2029-10-08': 'Thanksgiving Day',
    '2029-11-11': 'Remembrance Day',
    '2029-12-25': 'Christmas Day',
    '2029-12-26': 'Boxing Day',
    // 2030
    '2030-01-01': "New Year's Day",
    '2030-02-18': 'Family Day',
    '2030-04-19': 'Good Friday',
    '2030-04-22': 'Easter Monday',
    '2030-05-20': 'Victoria Day',
    '2030-07-01': 'Canada Day',
    '2030-08-05': 'BC Day',
    '2030-09-02': 'Labour Day',
    '2030-09-30': 'Natl Day for Truth & Reconciliation',
    '2030-10-14': 'Thanksgiving Day',
    '2030-11-11': 'Remembrance Day',
    '2030-12-25': 'Christmas Day',
    '2030-12-26': 'Boxing Day',
  };
  return all[dateStr] || null;
}

/**
 * Get the VCH pay date for a given date string (returns pay_date if dateStr is a pay_date)
 */
export function getPayDate(dateStr) {
  return VCH_PAY_PERIODS.find(p => p.pay_date === dateStr) || null;
}

/**
 * Get the VCH pay period number (e.g. "2613") for a pay period by matching its start date
 */
export function getVCHPeriodNumber(startDate) {
  const match = VCH_PAY_PERIODS.find(p => p.start === startDate);
  return match ? match.id : null;
}

/**
 * Get the VCH pay date for a pay period by matching its start date
 */
export function getVCHPayDate(startDate) {
  const match = VCH_PAY_PERIODS.find(p => p.start === startDate);
  return match ? match.pay_date : null;
}

// VCH 2025 pay periods (calculated from the official biweekly Fri–Thu pattern)
export const VCH_PAY_PERIODS_2025 = [
  { id: '2501', start: '2024-12-20', end: '2025-01-02', pay_date: '2025-01-10' },
  { id: '2502', start: '2025-01-03', end: '2025-01-16', pay_date: '2025-01-24' },
  { id: '2503', start: '2025-01-17', end: '2025-01-30', pay_date: '2025-02-07' },
  { id: '2504', start: '2025-01-31', end: '2025-02-13', pay_date: '2025-02-21' },
  { id: '2505', start: '2025-02-14', end: '2025-02-27', pay_date: '2025-03-07' },
  { id: '2506', start: '2025-02-28', end: '2025-03-13', pay_date: '2025-03-21' },
  { id: '2507', start: '2025-03-14', end: '2025-03-27', pay_date: '2025-04-04' },
  { id: '2508', start: '2025-03-28', end: '2025-04-10', pay_date: '2025-04-17' }, // Good Friday Apr 18 → Apr 17
  { id: '2509', start: '2025-04-11', end: '2025-04-24', pay_date: '2025-05-02' },
  { id: '2510', start: '2025-04-25', end: '2025-05-08', pay_date: '2025-05-16' },
  { id: '2511', start: '2025-05-09', end: '2025-05-22', pay_date: '2025-05-30' },
  { id: '2512', start: '2025-05-23', end: '2025-06-05', pay_date: '2025-06-13' },
  { id: '2513', start: '2025-06-06', end: '2025-06-19', pay_date: '2025-06-27' },
  { id: '2514', start: '2025-06-20', end: '2025-07-03', pay_date: '2025-07-11' },
  { id: '2515', start: '2025-07-04', end: '2025-07-17', pay_date: '2025-07-25' },
  { id: '2516', start: '2025-07-18', end: '2025-07-31', pay_date: '2025-08-08' },
  { id: '2517', start: '2025-08-01', end: '2025-08-14', pay_date: '2025-08-22' },
  { id: '2518', start: '2025-08-15', end: '2025-08-28', pay_date: '2025-09-05' },
  { id: '2519', start: '2025-08-29', end: '2025-09-11', pay_date: '2025-09-19' },
  { id: '2520', start: '2025-09-12', end: '2025-09-25', pay_date: '2025-10-03' },
  { id: '2521', start: '2025-09-26', end: '2025-10-09', pay_date: '2025-10-17' },
  { id: '2522', start: '2025-10-10', end: '2025-10-23', pay_date: '2025-10-31' },
  { id: '2523', start: '2025-10-24', end: '2025-11-06', pay_date: '2025-11-14' },
  { id: '2524', start: '2025-11-07', end: '2025-11-20', pay_date: '2025-11-28' },
  { id: '2525', start: '2025-11-21', end: '2025-12-04', pay_date: '2025-12-12' },
  { id: '2526', start: '2025-12-05', end: '2025-12-18', pay_date: '2025-12-24' }, // Dec 26 Boxing Day → Dec 24
];

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

// VCH 2027 pay periods (calculated from the official biweekly Fri–Thu pattern)
// Note: 2701 is the last entry of VCH_PAY_PERIODS_2026; this array starts at 2702
export const VCH_PAY_PERIODS_2027 = [
  { id: '2702', start: '2027-01-01', end: '2027-01-14', pay_date: '2027-01-22' },
  { id: '2703', start: '2027-01-15', end: '2027-01-28', pay_date: '2027-02-05' },
  { id: '2704', start: '2027-01-29', end: '2027-02-11', pay_date: '2027-02-19' },
  { id: '2705', start: '2027-02-12', end: '2027-02-25', pay_date: '2027-03-05' },
  { id: '2706', start: '2027-02-26', end: '2027-03-11', pay_date: '2027-03-19' },
  { id: '2707', start: '2027-03-12', end: '2027-03-25', pay_date: '2027-04-02' },
  { id: '2708', start: '2027-03-26', end: '2027-04-08', pay_date: '2027-04-16' },
  { id: '2709', start: '2027-04-09', end: '2027-04-22', pay_date: '2027-04-30' },
  { id: '2710', start: '2027-04-23', end: '2027-05-06', pay_date: '2027-05-14' },
  { id: '2711', start: '2027-05-07', end: '2027-05-20', pay_date: '2027-05-28' },
  { id: '2712', start: '2027-05-21', end: '2027-06-03', pay_date: '2027-06-11' },
  { id: '2713', start: '2027-06-04', end: '2027-06-17', pay_date: '2027-06-25' },
  { id: '2714', start: '2027-06-18', end: '2027-07-01', pay_date: '2027-07-09' },
  { id: '2715', start: '2027-07-02', end: '2027-07-15', pay_date: '2027-07-23' },
  { id: '2716', start: '2027-07-16', end: '2027-07-29', pay_date: '2027-08-06' },
  { id: '2717', start: '2027-07-30', end: '2027-08-12', pay_date: '2027-08-20' },
  { id: '2718', start: '2027-08-13', end: '2027-08-26', pay_date: '2027-09-03' },
  { id: '2719', start: '2027-08-27', end: '2027-09-09', pay_date: '2027-09-17' },
  { id: '2720', start: '2027-09-10', end: '2027-09-23', pay_date: '2027-10-01' },
  { id: '2721', start: '2027-09-24', end: '2027-10-07', pay_date: '2027-10-15' },
  { id: '2722', start: '2027-10-08', end: '2027-10-21', pay_date: '2027-10-29' },
  { id: '2723', start: '2027-10-22', end: '2027-11-04', pay_date: '2027-11-12' },
  { id: '2724', start: '2027-11-05', end: '2027-11-18', pay_date: '2027-11-26' },
  { id: '2725', start: '2027-11-19', end: '2027-12-02', pay_date: '2027-12-10' },
  { id: '2726', start: '2027-12-03', end: '2027-12-16', pay_date: '2027-12-24' },
  { id: '2801', start: '2027-12-17', end: '2027-12-30', pay_date: '2028-01-07' },
];

// VCH 2028 pay periods (calculated from the official biweekly Fri–Thu pattern)
// Note: 2801 is the last entry of VCH_PAY_PERIODS_2027; this array starts at 2802
export const VCH_PAY_PERIODS_2028 = [
  { id: '2802', start: '2027-12-31', end: '2028-01-13', pay_date: '2028-01-21' },
  { id: '2803', start: '2028-01-14', end: '2028-01-27', pay_date: '2028-02-04' },
  { id: '2804', start: '2028-01-28', end: '2028-02-10', pay_date: '2028-02-18' },
  { id: '2805', start: '2028-02-11', end: '2028-02-24', pay_date: '2028-03-03' },
  { id: '2806', start: '2028-02-25', end: '2028-03-09', pay_date: '2028-03-17' },
  { id: '2807', start: '2028-03-10', end: '2028-03-23', pay_date: '2028-03-31' },
  { id: '2808', start: '2028-03-24', end: '2028-04-06', pay_date: '2028-04-13' }, // Good Friday Apr 14 → Apr 13
  { id: '2809', start: '2028-04-07', end: '2028-04-20', pay_date: '2028-04-28' },
  { id: '2810', start: '2028-04-21', end: '2028-05-04', pay_date: '2028-05-12' },
  { id: '2811', start: '2028-05-05', end: '2028-05-18', pay_date: '2028-05-26' },
  { id: '2812', start: '2028-05-19', end: '2028-06-01', pay_date: '2028-06-09' },
  { id: '2813', start: '2028-06-02', end: '2028-06-15', pay_date: '2028-06-23' },
  { id: '2814', start: '2028-06-16', end: '2028-06-29', pay_date: '2028-07-07' },
  { id: '2815', start: '2028-06-30', end: '2028-07-13', pay_date: '2028-07-21' },
  { id: '2816', start: '2028-07-14', end: '2028-07-27', pay_date: '2028-08-04' },
  { id: '2817', start: '2028-07-28', end: '2028-08-10', pay_date: '2028-08-18' },
  { id: '2818', start: '2028-08-11', end: '2028-08-24', pay_date: '2028-09-01' },
  { id: '2819', start: '2028-08-25', end: '2028-09-07', pay_date: '2028-09-15' },
  { id: '2820', start: '2028-09-08', end: '2028-09-21', pay_date: '2028-09-29' },
  { id: '2821', start: '2028-09-22', end: '2028-10-05', pay_date: '2028-10-13' },
  { id: '2822', start: '2028-10-06', end: '2028-10-19', pay_date: '2028-10-27' },
  { id: '2823', start: '2028-10-20', end: '2028-11-02', pay_date: '2028-11-10' },
  { id: '2824', start: '2028-11-03', end: '2028-11-16', pay_date: '2028-11-24' },
  { id: '2825', start: '2028-11-17', end: '2028-11-30', pay_date: '2028-12-08' },
  { id: '2826', start: '2028-12-01', end: '2028-12-14', pay_date: '2028-12-22' },
  { id: '2901', start: '2028-12-15', end: '2028-12-28', pay_date: '2029-01-05' },
];

// Combined pay periods across all supported years
export const VCH_PAY_PERIODS = [
  ...VCH_PAY_PERIODS_2025,
  ...VCH_PAY_PERIODS_2026,
  ...VCH_PAY_PERIODS_2027,
  ...VCH_PAY_PERIODS_2028,
];

/**
 * Get the VCH pay period that contains a given date
 */
export function getVCHPayPeriod(dateStr) {
  return VCH_PAY_PERIODS.find(p => dateStr >= p.start && dateStr <= p.end) || null;
}

/**
 * Get current VCH pay period
 */
export function getCurrentVCHPayPeriod() {
  const today = new Date().toISOString().split('T')[0];
  return getVCHPayPeriod(today);
}
