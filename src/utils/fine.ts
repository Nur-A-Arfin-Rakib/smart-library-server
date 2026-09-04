export const FINE_PER_DAY = 5;
export const FINE_CAP = 250; // once reached, the book is treated as purchased
export const BORROW_LIMIT = 3;
export const BORROW_DURATION_DAYS = 30;
export const RENEWAL_DAYS = 7;

/**
 * Returns the fine (in Tk) for a book that is/was due on `dueDate`,
 * measured against `asOfDate` (defaults to now). Capped at FINE_CAP.
 */
export function calculateFine(dueDate: Date, asOfDate: Date = new Date()): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const daysLate = Math.max(0, Math.ceil((asOfDate.getTime() - dueDate.getTime()) / oneDay));
  if (daysLate === 0) return 0;
  return Math.min(daysLate * FINE_PER_DAY, FINE_CAP);
}
