import assert from 'node:assert/strict';
import test from 'node:test';
import { receiptInputSchema, refundInputSchema } from '../src/lib/payment-validation.ts';

const base = { projectId: 'a0c3f600-dc2b-44c5-8da9-6f972fe1c721', amount: '150000.25', paymentDate: '2026-10-11', category: 'advance', reference: '', notes: '' };

test('receipt amounts remain decimal strings and support partial payments', () => {
  assert.equal(receiptInputSchema.safeParse({ ...base, method: 'cash' }).data.amount, '150000.25');
  assert.equal(receiptInputSchema.safeParse({ ...base, amount: '150000.257', method: 'cash' }).success, false);
  assert.equal(receiptInputSchema.safeParse({ ...base, amount: 'NaN', method: 'cash' }).success, false);
});

test('bank transfers and cheques remain pending verification', () => {
  assert.equal(receiptInputSchema.parse({ ...base, method: 'bank_transfer' }).verificationStatus, 'pending_verification');
  assert.equal(receiptInputSchema.parse({ ...base, method: 'cheque' }).verificationStatus, 'pending_verification');
  assert.equal(receiptInputSchema.parse({ ...base, method: 'cash' }).verificationStatus, 'confirmed');
});

test('payment dates and refund reasons are validated', () => {
  assert.equal(receiptInputSchema.safeParse({ ...base, method: 'cash', paymentDate: '2026-02-30' }).success, false);
  assert.equal(refundInputSchema.safeParse({ receiptId: 'a0c3f600-dc2b-44c5-8da9-6f972fe1c721', amount: '300.00', method: 'cash', reason: 'Correction' }).success, true);
  assert.equal(refundInputSchema.safeParse({ receiptId: 'a0c3f600-dc2b-44c5-8da9-6f972fe1c721', amount: '300', method: 'cash', reason: 'x' }).success, false);
});
