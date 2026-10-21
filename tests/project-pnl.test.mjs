import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateProjectPnl } from '../src/lib/project-pnl-calc.ts';

test('calculates project P&L and margins with integer cents accuracy', () => {
  const pnl = calculateProjectPnl({
    contractValue: '1500000.00',
    confirmedReceipts: '500000.00',
    outstandingDue: '250000.00',
    materialsCost: '450000.00',
    labourCost: '350000.00',
  });

  assert.equal(pnl.contractValueMinor, 150000000n);
  assert.equal(pnl.materialsCostMinor, 45000000n);
  assert.equal(pnl.labourCostMinor, 35000000n);
  assert.equal(pnl.totalCostMinor, 80000000n);
  assert.equal(pnl.projectedProfitMinor, 70000000n);
  assert.equal(pnl.projectedProfitDisplay, 'LKR 700,000.00');
  assert.equal(pnl.profitMarginPercent, 46.66); // 700,000 / 1,500,000 * 100 = 46.66%
  assert.equal(pnl.isProfitable, true);
  // Cash flow = confirmed receipts (500,000) - total costs (800,000) = -300,000
  assert.equal(pnl.cashFlowMinor, -30000000n);
  assert.equal(pnl.cashFlowDisplay, '-LKR 300,000.00');
});

test('handles zero or missing values safely', () => {
  const pnl = calculateProjectPnl({
    contractValue: null,
    confirmedReceipts: undefined,
    outstandingDue: '',
    materialsCost: '0.00',
    labourCost: '12000.50',
  });

  assert.equal(pnl.contractValueMinor, 0n);
  assert.equal(pnl.totalCostMinor, 1200050n);
  assert.equal(pnl.projectedProfitMinor, -1200050n);
  assert.equal(pnl.profitMarginPercent, 0);
  assert.equal(pnl.isProfitable, false);
});
