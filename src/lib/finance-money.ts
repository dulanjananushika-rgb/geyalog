/** Exact LKR decimal helpers. All arithmetic is performed in integer cents. */
export function parseLkrToMinorUnits(value: string): bigint {
  const normalized = value.trim();
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(normalized)) throw new Error('Enter an LKR amount with up to 2 decimal places.');
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function minorUnitsToLkr(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}LKR ${whole}.${fraction}`;
}

export function decimalToMinorUnits(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === '') return 0n;
  return parseLkrToMinorUnits(String(value));
}

export function calculatePercentageAmount(amount: string, percentage: string): string {
  if (!/^(?:100|\d{1,2})(?:\.\d{1,4})?$/.test(percentage)) throw new Error('Enter a percentage from 0 to 100.');
  const [whole, fraction = ''] = percentage.split('.');
  const scaledPercentage = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
  const minor = parseLkrToMinorUnits(amount);
  const result = (minor * scaledPercentage + 500000n) / 1000000n;
  return `${result / 100n}.${(result % 100n).toString().padStart(2, '0')}`;
}

export type ObligationAmounts = { due: bigint; allocated: bigint; dueDate?: string | null; isDue: boolean; cancelled?: boolean; waived?: boolean };
export type FinancialTotals = {
  totalReceipts: bigint;
  totalRefunds: bigint;
  unallocatedCredit: bigint;
  currentlyDue: bigint;
  outstandingDue: bigint;
  overdue: bigint;
};

export function calculateFinancialTotals(
  receipts: { id: string; amount: string; status: 'pending_verification' | 'confirmed' | 'reversed' }[],
  refunds: { receiptId: string; amount: string }[],
  activeAllocationsByReceipt: Map<string, bigint>,
  obligations: ObligationAmounts[],
  today: string,
): FinancialTotals {
  let totalReceipts = 0n;
  let totalRefunds = 0n;
  let unallocatedCredit = 0n;
  receipts.forEach(receipt => {
    if (receipt.status !== 'confirmed') return;
    const amount = decimalToMinorUnits(receipt.amount);
    totalReceipts += amount;
    const allocated = activeAllocationsByReceipt.get(receipt.id) ?? 0n;
    const refunded = refunds.filter(refund => refund.receiptId === receipt.id).reduce((sum, refund) => sum + decimalToMinorUnits(refund.amount), 0n);
    totalRefunds += refunded;
    unallocatedCredit += amount > allocated + refunded ? amount - allocated - refunded : 0n;
  });
  let currentlyDue = 0n;
  let outstandingDue = 0n;
  let overdue = 0n;
  obligations.forEach(obligation => {
    if (obligation.cancelled || obligation.waived || !obligation.isDue) return;
    currentlyDue += obligation.due;
    const balance = obligation.due > obligation.allocated ? obligation.due - obligation.allocated : 0n;
    outstandingDue += balance;
    if (balance > 0n && obligation.dueDate && obligation.dueDate < today) overdue += balance;
  });
  return { totalReceipts, totalRefunds, unallocatedCredit, currentlyDue, outstandingDue, overdue };
}
