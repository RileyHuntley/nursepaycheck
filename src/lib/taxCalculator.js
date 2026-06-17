// 2026 BC Provincial tax brackets (cumulative/marginal)
const BC_BRACKETS = [
  { threshold: 50363,  rate: 0.056 },
  { threshold: 100728, rate: 0.077 },
  { threshold: 115648, rate: 0.105 },
  { threshold: 140430, rate: 0.1229 },
  { threshold: 190405, rate: 0.147 },
  { threshold: 265545, rate: 0.168 },
  { threshold: Infinity, rate: 0.205 },
];

// 2026 Federal tax brackets
const FED_BRACKETS = [
  { threshold: 58523,  rate: 0.14 },
  { threshold: 117045, rate: 0.205 },
  { threshold: 181440, rate: 0.26 },
  { threshold: 258482, rate: 0.29 },
  { threshold: Infinity, rate: 0.33 },
];

/**
 * Calculate marginal tax on `income` given an array of brackets.
 * `annualIncome` is the user's estimated annual taxable income from settings.
 * `periodIncome` is the gross pay for this period.
 * We find the effective marginal rate at the user's income level and apply it.
 */
function getMarginalRate(brackets, annualIncome) {
  for (const bracket of brackets) {
    if (annualIncome <= bracket.threshold) {
      return bracket.rate;
    }
  }
  return brackets[brackets.length - 1].rate;
}

/**
 * Estimate taxes on a pay period's gross pay.
 * Uses the marginal rate at the user's annual income threshold.
 * 
 * @param {number} periodGross - gross pay for the period (before union dues)
 * @param {number} annualProvincialIncome - estimated annual taxable income for BC provincial tax
 * @param {number} annualFederalIncome - estimated annual taxable income for federal tax
 * @returns {{ provincial: number, federal: number, total: number }}
 */
export function estimateTaxes(periodGross, annualProvincialIncome, annualFederalIncome) {
  if (!periodGross || periodGross <= 0) return { provincial: 0, federal: 0, total: 0 };

  const provincial = annualProvincialIncome > 0
    ? periodGross * getMarginalRate(BC_BRACKETS, annualProvincialIncome)
    : 0;

  const federal = annualFederalIncome > 0
    ? periodGross * getMarginalRate(FED_BRACKETS, annualFederalIncome)
    : 0;

  return {
    provincial: Math.round(provincial * 100) / 100,
    federal: Math.round(federal * 100) / 100,
    total: Math.round((provincial + federal) * 100) / 100,
  };
}

/**
 * Estimate statutory deductions (CPP, CPP2, EI) for a pay period.
 * Calculates annual contribution at the given annual income, then prorates to the period.
 *
 * @param {number} periodGross - total gross pay for this period (used for EI proration)
 * @param {number} annualIncome - estimated annual taxable income (federal)
 * @param {number} [pensionableEarnings] - pensionable earnings for CPP (excludes overtime/stat pay). Defaults to periodGross.
 * @returns {{ cpp: number, cpp2: number, ei: number, total: number }}
 */
export function estimateStatutoryDeductions(periodGross, annualIncome, pensionableEarnings) {
  if (!periodGross || periodGross <= 0 || !annualIncome || annualIncome <= 0) {
    return { cpp: 0, cpp2: 0, ei: 0, total: 0 };
  }

  // Overtime is NOT pensionable for CPP — use pensionableEarnings (straight-time pay) if provided
  const pensionableGross = pensionableEarnings != null ? pensionableEarnings : periodGross;

  // CPP: 5.95% on pensionable earnings between $3,500 and $74,600
  const CPP_RATE = 0.0595;
  const CPP_EXEMPTION = 3500;
  const CPP_CEILING = 74600;
  const CPP_MAX_PENSIONABLE = CPP_CEILING - CPP_EXEMPTION; // 71,100
  const CPP_MAX = 4230.45;

  let annualCpp = 0;
  if (annualIncome > CPP_EXEMPTION) {
    const pensionable = Math.min(annualIncome, CPP_CEILING) - CPP_EXEMPTION;
    annualCpp = Math.min(pensionable * CPP_RATE, CPP_MAX);
  }

  // CPP2: 4.0% on earnings between $74,600 and $85,000 (also pensionable earnings only, no overtime)
  const CPP2_RATE = 0.04;
  const CPP2_FLOOR = 74600;
  const CPP2_CEILING = 85000;
  const CPP2_MAX = 416.00;

  let annualCpp2 = 0;
  if (annualIncome > CPP2_FLOOR) {
    const cpp2Earnings = Math.min(annualIncome, CPP2_CEILING) - CPP2_FLOOR;
    annualCpp2 = Math.min(cpp2Earnings * CPP2_RATE, CPP2_MAX);
  }

  // EI: 1.63% on all insurable earnings up to $68,900 (includes overtime)
  const EI_RATE = 0.0163;
  const EI_CEILING = 68900;
  const EI_MAX = 1123.07;

  const insurable = Math.min(annualIncome, EI_CEILING);
  const annualEi = Math.min(insurable * EI_RATE, EI_MAX);

  // Pro-rate to this pay period — CPP/CPP2 use pensionable ratio; EI uses gross ratio
  const cppRatio = pensionableGross / annualIncome;
  const eiRatio = periodGross / annualIncome;

  return {
    cpp: Math.round(annualCpp * cppRatio * 100) / 100,
    cpp2: Math.round(annualCpp2 * cppRatio * 100) / 100,
    ei: Math.round(annualEi * eiRatio * 100) / 100,
    total: Math.round((annualCpp * cppRatio + annualCpp2 * cppRatio + annualEi * eiRatio) * 100) / 100,
  };
}

export const BC_BRACKETS_INFO = BC_BRACKETS;
export const FED_BRACKETS_INFO = FED_BRACKETS;
export const CPP_CONFIG = { rate: 0.0595, exemption: 3500, ceiling: 74600, max: 4230.45 };
export const CPP2_CONFIG = { rate: 0.04, floor: 74600, ceiling: 85000, max: 416.00 };
export const EI_CONFIG = { rate: 0.0163, ceiling: 68900, max: 1123.07 };