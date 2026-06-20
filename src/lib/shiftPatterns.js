import { getStatType } from '@/lib/statHolidays';

// Built-in shift patterns for bulk add
// Each pattern has a name, description, and a sequence of shift templates.
// Null entries represent off days.
// Sequence days advance one calendar day per step.

const DAY_SHIFT_12H = {
  start_time: '07:00',
  end_time: '19:00',
  paid_hours: 11,
  unpaid_break: 1,
  paid_break: 0.75,
  shift_type: 'regular',
};

const NIGHT_SHIFT_12H = {
  start_time: '19:00',
  end_time: '07:00',
  paid_hours: 11,
  unpaid_break: 1,
  paid_break: 0.75,
  shift_type: 'regular',
};

const DAY_SHIFT_8H = {
  start_time: '08:00',
  end_time: '16:00',
  paid_hours: 7.5,
  unpaid_break: 0.5,
  paid_break: 0,
  shift_type: 'regular',
};

export const SHIFT_PATTERNS = [
  {
    name: 'DDNN',
    description: '4 on, 4 off — 12h Day, Day, Night, Night',
    sequence: [
      DAY_SHIFT_12H,
      DAY_SHIFT_12H,
      NIGHT_SHIFT_12H,
      NIGHT_SHIFT_12H,
      null,
      null,
      null,
      null,
    ],
  },
  {
    name: 'M-F',
    description: 'Monday–Friday — 8h day shifts, weekends off',
    sequence: [
      DAY_SHIFT_8H,
      DAY_SHIFT_8H,
      DAY_SHIFT_8H,
      DAY_SHIFT_8H,
      DAY_SHIFT_8H,
      null,
      null,
    ],
  },
];

export function getShiftPattern(name) {
  return SHIFT_PATTERNS.find(p => p.name === name) || SHIFT_PATTERNS[0];
}

function customStepToTemplate(step, presetTimes) {
  const pt = presetTimes || {};
  if (step === 'D') return { start_time: pt.day_12h_start || '07:00', end_time: pt.day_12h_end || '19:00', paid_hours: 11, unpaid_break: 1, paid_break: 0.75, shift_type: 'regular' };
  if (step === 'N') return { start_time: pt.night_12h_start || '19:00', end_time: pt.night_12h_end || '07:00', paid_hours: 11, unpaid_break: 1, paid_break: 0.75, shift_type: 'regular' };
  if (step === '8') return { start_time: pt.day_8h_start || '08:00', end_time: pt.day_8h_end || '16:00', paid_hours: 7.5, unpaid_break: 0.5, paid_break: 0, shift_type: 'regular' };
  return null;
}

export function getAllPatterns(settings) {
  const custom = (settings?.custom_shift_patterns || []).map(cp => ({
    name: cp.name,
    description: cp.description,
    sequence: (cp.sequence || []).map(step => customStepToTemplate(step, settings?.preset_times)),
  }));
  return [...SHIFT_PATTERNS, ...custom];
}

export function describeCustomSequence(sequence) {
  const workDays = sequence.filter(s => s !== null).length;
  const offDays = sequence.filter(s => s === null).length;
  const typeStr = sequence.map(s => {
    if (s === 'D') return 'Day';
    if (s === 'N') return 'Night';
    if (s === '8') return '8h Day';
    return null;
  }).filter(Boolean).join(', ');
  const parts = [];
  if (workDays > 0 && offDays > 0) parts.push(`${workDays} on, ${offDays} off`);
  else if (workDays > 0) parts.push(`${workDays} on`);
  if (typeStr) parts.push(typeStr);
  return parts.join(' — ');
}

/**
 * Generate shifts from a pattern starting at a given date.
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {object} pattern - Pattern object with sequence array
 * @param {number} repetitions - How many times to repeat the pattern
 * @param {object} defaults - { hospital, unit } to apply to all generated shifts
 * @returns {Array} Array of shift objects (only working days, no off days)
 */
export function generateShiftsFromPattern(startDate, pattern, repetitions, defaults = {}) {
  const shifts = [];
  const start = new Date(startDate + 'T12:00:00');
  let dayOffset = 0;

  for (let r = 0; r < repetitions; r++) {
    for (const step of pattern.sequence) {
      const date = new Date(start);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().slice(0, 10);
      dayOffset++;

      if (step !== null) {
        // Stat/overtime multipliers are auto-calculated — type stays as selected
        shifts.push({
          date: dateStr,
          ...step,
          shift_type: step.shift_type,
          hospital: defaults.hospital || '',
          unit: defaults.unit || '',
          short_notice: false,
          specialty_premium: defaults.specialty_premium || false,
          responsibility_pay: 'none',
          preceptor: defaults.preceptor || false,
          on_call_hours: 0,
          extended_shift: false,
          notes: '',
        });
      }
    }
  }

  return shifts;
}