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

export const BC_BRACKETS_INFO = BC_BRACKETS;
export const FED_BRACKETS_INFO = FED_BRACKETS;