import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFinancialTotals,
  calculatePercentageAmount,
  decimalToMinorUnits,
  minorUnitsToLkr,
  parseLkrToMinorUnits,
} from '../src/lib/finance-money.ts';
import {
  calculateDailyEarning,
  calculateDailyRatePeriod,
  calculateLabourBalances,
  calculateTaskEarning,
  calculateTaskFixedAmount,
  calculateWeeklyEarning,
} from '../src/lib/labour-money.ts';
import {
  calculateInventoryBalances,
  calculateMaterialLineValue,
  calculateSupplierInvoiceTotal,
  formatQuantity,
  parseQuantity,
} from '../src/lib/materials-money.ts';
import { buildReceiptHtml } from '../src/lib/receipt-pdf.ts';

test('LKR calculations use integer minor units and preserve decimal precision', () => {
  assert.equal(parseLkrToMinorUnits('150000.10'), 15000010n);
  assert.equal(minorUnitsToLkr(99999999999999n), 'LKR 999,999,999,999.99');
  assert.equal(decimalToMinorUnits('0.01') + decimalToMinorUnits('0.09'), 10n);
  assert.throws(() => parseLkrToMinorUnits('1.005'));
  assert.throws(() => parseLkrToMinorUnits('1e6'));
});

test('percentage payment terms use exact decimal arithmetic and round to cents', () => {
  assert.equal(calculatePercentageAmount('1000000.00', '12.5'), '125000.00');
  assert.equal(calculatePercentageAmount('999.99', '33.3333'), '333.33');
  assert.equal(calculatePercentageAmount('100.00', '100'), '100.00');
});

test('partial allocations calculate exact due, remaining balance, and overdue amount', () => {
  const totals = calculateFinancialTotals(
    [{ id: 'r1', amount: '200000.00', status: 'confirmed' }, { id: 'r2', amount: '50000.00', status: 'pending_verification' }],
    [], new Map(),
    [{ due: 50000000n, allocated: 20000000n, dueDate: '2026-10-01', isDue: true }],
    '2026-10-11',
  );
  assert.equal(totals.totalReceipts, 20000000n);
  assert.equal(totals.currentlyDue, 50000000n);
  assert.equal(totals.outstandingDue, 30000000n);
  assert.equal(totals.overdue, 30000000n);
});

test('daily and configurable half-day wage math uses exact cents', () => {
  assert.equal(calculateDailyEarning('4500.00', '1'), '4500.00');
  assert.equal(calculateDailyEarning('4500.00', '0.375'), '1687.50');
  assert.equal(calculateDailyEarning('3000.10', '0.5'), '1500.05');
  assert.throws(() => calculateDailyEarning('4500', '1.01'));
});

test('weekly earning calculation separates earning rules from payment schedule', () => {
  assert.equal(calculateDailyRatePeriod('3000.00', ['1', '1', '1', '1', '1', '1']), '18000.00');
  assert.equal(calculateWeeklyEarning('18000.00', ['1', '1', '0.5'], 6, 'prorate_by_workdays'), '7500.00');
  assert.equal(calculateWeeklyEarning('10000.00', ['1', '1', '1', '1', '1', '1'], 6, 'prorate_by_workdays'), '10000.00');
  assert.equal(calculateWeeklyEarning('18000.00', ['0.5'], 6, 'full_week_on_attendance'), '18000.00');
});

test('quantity and fixed-task calculations round only at the agreed currency precision', () => {
  assert.equal(calculateTaskEarning('350.00', '400'), '140000.00');
  assert.equal(calculateTaskEarning('12.50', '0.3333'), '4.17');
  const first = calculateTaskFixedAmount('1000.00', '3', '0', '1');
  const second = calculateTaskFixedAmount('1000.00', '3', '1', '1');
  const final = calculateTaskFixedAmount('1000.00', '3', '2', '1');
  assert.equal(`${first},${second},${final}`, '333.33,333.34,333.33');
  assert.throws(() => calculateTaskFixedAmount('1000.00', '3', '2', '2'));
});

test('earned wages, paid cash, and unrecovered advances remain separate', () => {
  assert.deepEqual(
    calculateLabourBalances({
      earned: '20000.00',
      confirmedPayments: '18000.00',
      advancesPaid: '5000.00',
      advanceOffsets: '3000.00',
    }),
    {
      outstandingEarned: '4000.00',
      unrecoveredAdvances: '2000.00',
      confirmedCashOutflow: '18000.00',
    },
  );
});

test('material quantities use exact four-decimal fixed-point arithmetic', () => {
  assert.equal(formatQuantity(parseQuantity('12.3401') + parseQuantity('0.0099')), '12.35');
  assert.throws(() => parseQuantity('1.00001'));
});

test('purchase line and invoice totals use exact LKR cents', () => {
  assert.equal(calculateMaterialLineValue('350.00', '400', '0.00', '0.00'), '140000.00');
  assert.equal(calculateMaterialLineValue('12.50', '0.3333', '0.00', '0.00'), '4.17');
  assert.equal(calculateSupplierInvoiceTotal('140000.00', '1000.00', '2520.00', '750.00'), '142270.00');
  assert.throws(() => calculateSupplierInvoiceTotal('100.00', '101.00', '0.00', '0.00'));
});

test('inventory balances keep unit and ownership provenance separate', () => {
  const rows = calculateInventoryBalances([
    { materialId: 'cement', unit: 'Bags', fundingSource: 'contractor', quantityDelta: '10' },
    { materialId: 'cement', unit: 'Bags', fundingSource: 'contractor', quantityDelta: '-2.25' },
    { materialId: 'cement', unit: 'Bags', fundingSource: 'customer', quantityDelta: '3' },
    { materialId: 'cement', unit: 'Kilograms', fundingSource: 'contractor', quantityDelta: '100' },
  ]);
  assert.deepEqual(
    rows.map((x) => [x.unit, x.fundingSource, x.quantity]).sort(),
    [
      ['Bags', 'contractor', '7.75'],
      ['Bags', 'customer', '3'],
      ['Kilograms', 'contractor', '100'],
    ],
  );
});

test('receipt PDF HTML generation includes required details and disclaimer', () => {
  const html = buildReceiptHtml({
    company: 'Lakshan Constructions',
    receiptNumber: 'REC-2026-001',
    projectRef: 'PRJ-01',
    projectName: 'Kandy Villa',
    customer: 'Sunil Silva',
    amount: 'LKR 250,000.00',
    method: 'bank_transfer',
    paymentDate: '2026-10-15',
    reference: 'TXN12345',
    notes: 'Advance for foundation',
    status: 'Confirmed',
    issuedDate: '2026-10-15',
  });
  assert.equal(html.includes('Lakshan Constructions'), true);
  assert.equal(html.includes('REC-2026-001'), true);
  assert.equal(html.includes('LKR 250,000.00'), true);
  assert.equal(html.includes('This document acknowledges a payment recorded by the contractor'), true);
});
