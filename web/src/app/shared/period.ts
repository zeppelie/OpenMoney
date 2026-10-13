/** Un mese di un anno: è l'unità con cui si sfogliano movimenti, statistiche e budget. */
export interface Period {
  year: number;
  /** Da 1 a 12. */
  month: number;
}

const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long' });
const pad = (n: number) => String(n).padStart(2, '0');

export function monthLabel(month: number): string {
  return monthName.format(new Date(2000, month - 1, 1));
}

export function currentPeriod(): Period {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

export function shiftPeriod({ year, month }: Period, months: number): Period {
  const moved = new Date(year, month - 1 + months, 1);
  return { year: moved.getFullYear(), month: moved.getMonth() + 1 };
}

/** Data in formato ISO aaaa-mm-gg, quello che si scambia con il server. */
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}
