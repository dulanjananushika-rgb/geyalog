import { decimalToMinorUnits, parseLkrToMinorUnits } from './finance-money';

const roundRatio = (numerator: bigint, denominator: bigint) => {
  if (denominator <= 0n) throw new Error('Rate divisor must be greater than zero.');
  return (numerator + denominator / 2n) / denominator;
};

export function moneyFromMinorUnits(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const absolute = cents < 0n ? -cents : cents;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

export function formatLkr(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return `LKR ${value}`;
  const grouped = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${match[1]}LKR ${grouped}.${(match[3] ?? '').padEnd(2, '0')}`;
}

export function calculateDailyEarning(rate: string, workFraction: string): string {
  const fraction = parseRatio(workFraction, 4);
  if (fraction < 0n || fraction > 10_000n) throw new Error('Work fraction must be between 0 and 1.');
  return moneyFromMinorUnits(roundRatio(parseLkrToMinorUnits(rate) * fraction, 10_000n));
}

export function calculateDailyRatePeriod(rate: string, workFractions: string[]): string {
  const totalFraction = workFractions.reduce((total, fraction) => total + parseRatio(fraction, 4), 0n);
  return moneyFromMinorUnits(roundRatio(parseLkrToMinorUnits(rate) * totalFraction, 10_000n));
}

export function calculateWeeklyEarning(rate: string, workFractions: string[], expectedWorkdays: number, policy: 'prorate_by_workdays' | 'full_week_on_attendance'): string {
  if (!Number.isInteger(expectedWorkdays) || expectedWorkdays < 1 || expectedWorkdays > 7) throw new Error('Expected workdays must be between 1 and 7.');
  const worked = workFractions.reduce((total, fraction) => total + parseRatio(fraction, 4), 0n);
  if (worked <= 0n) return '0.00';
  const weekly = parseLkrToMinorUnits(rate);
  const scaledDays = BigInt(expectedWorkdays) * 10_000n;
  return moneyFromMinorUnits(policy === 'full_week_on_attendance' ? weekly : roundRatio(weekly * (worked > scaledDays ? scaledDays : worked), scaledDays));
}

export function calculateTaskEarning(rate: string, quantity: string): string {
  const rateCents = parseLkrToMinorUnits(rate);
  const quantityScaled = parseRatio(quantity, 4);
  if (quantityScaled < 0n) throw new Error('Quantity cannot be negative.');
  return moneyFromMinorUnits(roundRatio(rateCents * quantityScaled, 10_000n));
}

export function calculateTaskFixedAmount(agreedAmount: string, estimatedQuantity: string, previousQuantity: string, approvedQuantity: string): string {
  const total = parseLkrToMinorUnits(agreedAmount);
  const estimate = parseRatio(estimatedQuantity, 4);
  const previous = parseRatio(previousQuantity, 4);
  const approved = parseRatio(approvedQuantity, 4);
  if (estimate <= 0n || previous < 0n || approved < 0n || previous + approved > estimate) throw new Error('Approved quantity exceeds the agreed task amount.');
  const before = roundRatio(total * previous, estimate);
  const after = roundRatio(total * (previous + approved), estimate);
  return moneyFromMinorUnits(after - before);
}

export function calculateLabourBalances(input: {
  earned: string;
  confirmedPayments: string;
  advancesPaid: string;
  advanceOffsets: string;
}): { outstandingEarned: string; unrecoveredAdvances: string; confirmedCashOutflow: string } {
  const earned = decimalToMinorUnits(input.earned);
  const payment = decimalToMinorUnits(input.confirmedPayments);
  const advances = decimalToMinorUnits(input.advancesPaid);
  const offsets = decimalToMinorUnits(input.advanceOffsets);
  const positive = (value: bigint) => value > 0n ? value : 0n;
  return {
    outstandingEarned: moneyFromMinorUnits(positive(earned - (payment - advances) - offsets)),
    unrecoveredAdvances: moneyFromMinorUnits(positive(advances - offsets)),
    confirmedCashOutflow: moneyFromMinorUnits(payment),
  };
}

function parseRatio(value: string, scale: number): bigint {
  const pattern = new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${scale}})?$`);
  if (!pattern.test(value)) throw new Error(`Enter a valid number with up to ${scale} decimal places.`);
  const [whole, decimal = ''] = value.split('.');
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt(decimal.padEnd(scale, '0'));
}
