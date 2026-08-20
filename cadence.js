// When a recurring task is next due. Arithmetic only -- no network, no
// credential, no imports.
//
// Split out of `bin/life` for the reason Project-Station splits chartSeries.js
// out of its renderer: this is arithmetic with a right answer, and arithmetic
// with a right answer belongs where a test can see it. bin/life exits at
// import time without TAMARADA_URL, so nothing inside it can be checked at
// all -- which would leave the month rule below resting entirely on having
// read it carefully once.
//
// The rule that needs the most protecting: a month is not 30 days. Flattening
// it makes 月底繳費 drift a day earlier every month until it lands in the
// wrong month -- slowly, plausibly, and never with an error.

// Nd / Nw / Nm. Parsed rather than coerced: `--every week` would otherwise
// become NaN, fall through, and write a task with a cadence that never comes
// due -- wrong in the one direction that never announces itself.
const CADENCE = /^(\d+)([dwm])$/;

export function parseEvery(s) {
  const m = CADENCE.exec(String(s ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 ? { n, unit: m[2] } : null;
}

export function sayEvery(every) {
  if (!every) return null;
  const word = { d: 'day', w: 'week', m: 'month' }[every.unit];
  return `every ${every.n} ${word}${every.n > 1 ? 's' : ''}`;
}

export const dayOf = (date) => date.toISOString().slice(0, 10);

// `today` is passed in rather than read from the clock, so every caller in one
// run agrees on what day it is -- and so this is checkable at all. A function
// that asks the clock itself can only be tested by moving the clock.
export function nextDue(task, today) {
  // Never done means due now. The alternative -- due one cadence after it was
  // created -- hides a brand-new task for a week, and the reason somebody
  // writes one down is that it is on their mind today.
  if (!task?.lastDone) return today;
  const every = parseEvery(task.every);
  if (!every) return today;
  const d = new Date(`${task.lastDone}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return today;

  if (every.unit === 'd') d.setUTCDate(d.getUTCDate() + every.n);
  if (every.unit === 'w') d.setUTCDate(d.getUTCDate() + every.n * 7);
  if (every.unit === 'm') {
    // Clamped to the end of the target month. Without the clamp, Date rolls
    // over silently: Jan 31 + 1 month is March 3rd, so a monthly task set on
    // the 31st walks forward through the year and nothing ever reports it.
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + every.n);
    const lastOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, lastOfMonth));
  }
  return dayOf(d);
}

// Negative means overdue. Whole days, computed in UTC at midnight so a run at
// 23:50 and a run at 00:10 do not disagree about whether something is due.
export function daysUntil(due, today) {
  return Math.round((new Date(`${due}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000);
}
