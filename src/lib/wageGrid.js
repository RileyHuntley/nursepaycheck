// NBA 2022-2025 Wage Grid — Effective April 1, 2024 (2.0% GWI + 1.0% COLA)
// Source: 2022_2025_NBA_Wage_Grids.pdf (BCNU)
// Shift premiums are NOT included; they are paid on top of these rates.

export const WAGE_GRID_EFFECTIVE_DATE = '2024-04-01';
export const WAGE_GRID_EFFECTIVE_LABEL = 'April 1, 2024';

export const LEVELS = [
  { key: 'L1_LPN',    label: 'Level 1 — LPN',      designation: 'LPN' },
  { key: 'L2_LPN',    label: 'Level 2 — LPN',      designation: 'LPN' },
  { key: 'L3_RN_RPN', label: 'Level 3 — RN / RPN', designation: 'RN/RPN' },
  { key: 'L4_RN_RPN', label: 'Level 4 — RN / RPN', designation: 'RN/RPN' },
  { key: 'L5_RN_RPN', label: 'Level 5 — RN / RPN', designation: 'RN/RPN' },
  { key: 'L6_RN_RPN', label: 'Level 6 — RN / RPN', designation: 'RN/RPN' },
];

export const RECOGNITION_BANDS = [
  { key: 'base', label: 'Base (no long-service)' },
  { key: 'r15',  label: '15 Years / 29,250 Hours' },
  { key: 'r20',  label: '20 Years / 39,000 Hours' },
  { key: 'r25',  label: '25 Years / 48,750 Hours' },
  { key: 'r30',  label: '30 Years / 58,500 Hours' },
];

export const INCREMENTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Hourly rates indexed by [level key][recognition band key][increment index (0-based)]
export const WAGE_GRID = {
  L1_LPN: {
    base: [32.84, 33.78, 34.50, 35.48, 36.46, 37.44, 38.42, 39.40, 40.38, 41.35],
    r15:  [33.36, 34.30, 35.02, 36.00, 36.98, 37.96, 38.94, 39.92, 40.90, 41.87],
    r20:  [34.13, 35.07, 35.79, 36.77, 37.75, 38.73, 39.71, 40.69, 41.67, 42.64],
    r25:  [35.16, 36.10, 36.82, 37.80, 38.78, 39.76, 40.74, 41.72, 42.70, 43.67],
    r30:  [36.45, 37.39, 38.11, 39.09, 40.07, 41.05, 42.03, 43.01, 43.99, 44.96],
  },
  L2_LPN: {
    base: [34.20, 35.18, 35.94, 36.92, 37.90, 38.88, 39.86, 40.84, 41.82, 42.79],
    r15:  [34.72, 35.70, 36.46, 37.44, 38.42, 39.40, 40.38, 41.36, 42.34, 43.31],
    r20:  [35.49, 36.47, 37.23, 38.21, 39.19, 40.17, 41.15, 42.13, 43.11, 44.08],
    r25:  [36.52, 37.50, 38.26, 39.24, 40.22, 41.20, 42.18, 43.16, 44.14, 45.11],
    r30:  [37.81, 38.79, 39.55, 40.53, 41.51, 42.49, 43.47, 44.45, 45.43, 46.40],
  },
  L3_RN_RPN: {
    base: [41.42, 43.00, 44.58, 46.20, 47.82, 49.44, 51.06, 52.68, 54.29, 55.91],
    r15:  [41.94, 43.52, 45.10, 46.72, 48.34, 49.96, 51.58, 53.20, 54.81, 56.43],
    r20:  [42.71, 44.29, 45.87, 47.49, 49.11, 50.73, 52.35, 53.97, 55.58, 57.20],
    r25:  [43.74, 45.32, 46.90, 48.52, 50.14, 51.76, 53.38, 55.00, 56.61, 58.23],
    r30:  [45.03, 46.61, 48.19, 49.81, 51.43, 53.05, 54.67, 56.29, 57.90, 59.52],
  },
  L4_RN_RPN: {
    base: [49.20, 50.75, 52.30, 53.89, 55.48, 57.08, 58.68, 60.28, 61.87, 63.47],
    r15:  [49.72, 51.27, 52.82, 54.41, 56.00, 57.60, 59.20, 60.80, 62.39, 63.99],
    r20:  [50.49, 52.04, 53.59, 55.18, 56.77, 58.37, 59.97, 61.57, 63.16, 64.76],
    r25:  [51.52, 53.07, 54.62, 56.21, 57.80, 59.40, 61.00, 62.60, 64.19, 65.79],
    r30:  [52.81, 54.36, 55.91, 57.50, 59.09, 60.69, 62.29, 63.89, 65.48, 67.08],
  },
  L5_RN_RPN: {
    base: [52.39, 53.93, 55.48, 57.07, 58.67, 60.26, 61.86, 63.46, 65.05, 66.65],
    r15:  [52.91, 54.45, 56.00, 57.59, 59.19, 60.78, 62.38, 63.98, 65.57, 67.17],
    r20:  [53.68, 55.22, 56.77, 58.36, 59.96, 61.55, 63.15, 64.75, 66.34, 67.94],
    r25:  [54.71, 56.25, 57.80, 59.39, 60.99, 62.58, 64.18, 65.78, 67.37, 68.97],
    r30:  [56.00, 57.54, 59.09, 60.68, 62.28, 63.87, 65.47, 67.07, 68.66, 70.26],
  },
  L6_RN_RPN: {
    base: [54.51, 56.06, 57.60, 59.19, 60.79, 62.39, 63.98, 65.58, 67.18, 68.78],
    r15:  [55.03, 56.58, 58.12, 59.71, 61.31, 62.91, 64.50, 66.10, 67.70, 69.30],
    r20:  [55.80, 57.35, 58.89, 60.48, 62.08, 63.68, 65.27, 66.87, 68.47, 70.07],
    r25:  [56.83, 58.38, 59.92, 61.51, 63.11, 64.71, 66.30, 67.90, 69.50, 71.10],
    r30:  [58.12, 59.67, 61.21, 62.80, 64.40, 66.00, 67.59, 69.19, 70.79, 72.39],
  },
};

/**
 * Look up the hourly rate from the wage grid.
 * @param {string} levelKey - one of LEVELS[].key
 * @param {string} bandKey - one of RECOGNITION_BANDS[].key
 * @param {number} increment - 1-based increment number (1–10)
 * @returns {number|null} hourly rate or null if not found
 */
export function lookupWageGridRate(levelKey, bandKey, increment) {
  const rates = WAGE_GRID[levelKey]?.[bandKey];
  if (!rates) return null;
  const idx = increment - 1;
  if (idx < 0 || idx >= rates.length) return null;
  return rates[idx];
}
