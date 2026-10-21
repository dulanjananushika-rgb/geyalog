import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceSchema, labourAdvanceSchema, labourTaskProgressSchema, labourTaskSchema, settlementPaymentSchema, settlementPeriodSchema, subcontractorAgreementSchema, subcontractorPaymentSchema, workerAssignmentSchema, workerSchema } from '../src/lib/workforce-validation.ts';

test('worker details validate and optional contact can remain blank', () => {
  const parsed = workerSchema.safeParse({ fullName: 'Nimal Perera', phone: '', skillCategory: 'Mason', engagementType: 'daily_worker', notes: '' });
  assert.equal(parsed.success, true);
});

test('task based assignments require a unit and preserve decimal rates as strings', () => {
  const base = { workerId: '3df11457-fb93-4d68-a847-5dfe21438fe9', projectId: '4680c1e2-4447-498d-8ea6-87d403287e4c', workRole: 'Tile work', startDate: '2026-10-11', earningMethod: 'task_quantity', paymentSchedule: 'task_completion', rate: '350.2500', effectiveFrom: '2026-10-11', halfDayFactor: '0.5' };
  assert.equal(workerAssignmentSchema.safeParse({ ...base, unitName: '' }).success, false);
  assert.equal(workerAssignmentSchema.safeParse({ ...base, unitName: 'sq ft' }).success, true);
});

test('attendance status and fractions stay consistent for leave and absences', () => {
  const base = { workerAssignmentId: '3df11457-fb93-4d68-a847-5dfe21438fe9', workerId: '4680c1e2-4447-498d-8ea6-87d403287e4c', projectId: 'd70c8939-66df-448b-bd2c-9694525ad9b0', workDate: '2026-10-11', hoursWorked: '', notes: '' };
  assert.equal(attendanceSchema.safeParse({ ...base, attendanceStatus: 'absent', dayFraction: '1' }).success, false);
  assert.equal(attendanceSchema.safeParse({ ...base, attendanceStatus: 'absent', dayFraction: '0' }).success, true);
});

test('settlement periods reject reversed ranges and labour money uses two decimal places', () => {
  const assignmentId = '3df11457-fb93-4d68-a847-5dfe21438fe9';
  assert.equal(settlementPeriodSchema.safeParse({ assignmentId, startDate: '2026-10-12', endDate: '2026-10-11' }).success, false);
  const payment = { settlementId: assignmentId, paymentDate: '2026-10-11', method: 'cash' };
  assert.equal(settlementPaymentSchema.safeParse({ ...payment, amount: '125000.00' }).success, true);
  assert.equal(settlementPaymentSchema.safeParse({ ...payment, amount: '125000.001' }).success, false);
});

test('cash advances require a positive decimal amount and valid account references', () => {
  const valid = { projectId: '3df11457-fb93-4d68-a847-5dfe21438fe9', workerId: '4680c1e2-4447-498d-8ea6-87d403287e4c', amount: '5000.00', paymentDate: '2026-10-11', method: 'cash' };
  assert.equal(labourAdvanceSchema.safeParse(valid).success, true);
  assert.equal(labourAdvanceSchema.safeParse({ ...valid, amount: '5000.001' }).success, false);
});

test('unit rate and fixed task agreements require the correct decimal basis', () => {
  const base = { projectId: '3df11457-fb93-4d68-a847-5dfe21438fe9', assignmentId: '4680c1e2-4447-498d-8ea6-87d403287e4c', taskName: 'Tile installation', unitName: 'sq ft' };
  assert.equal(labourTaskSchema.safeParse({ ...base, paymentBasis: 'unit_rate', unitRate: '350.2500' }).success, true);
  assert.equal(labourTaskSchema.safeParse({ ...base, paymentBasis: 'fixed_task', fixedAmount: '140000.00', estimatedQuantity: '400' }).success, true);
  assert.equal(labourTaskSchema.safeParse({ ...base, paymentBasis: 'fixed_task', fixedAmount: '140000.00', estimatedQuantity: '' }).success, false);
});

test('task progress and subcontractor payments reject unsafe monetary precision', () => {
  const taskId = 'c84b221b-8b77-4bd4-8a32-3bcd311d6921';
  assert.equal(labourTaskProgressSchema.safeParse({ taskId, quantity: '12.1250', progressDate: '2026-10-11' }).success, true);
  assert.equal(labourTaskProgressSchema.safeParse({ taskId, quantity: '12.12345', progressDate: '2026-10-11' }).success, false);
  assert.equal(subcontractorPaymentSchema.safeParse({ workRecordId: taskId, amount: '1250.50', paymentDate: '2026-10-11', method: 'cash' }).success, true);
  assert.equal(subcontractorPaymentSchema.safeParse({ workRecordId: taskId, amount: '1250.501', paymentDate: '2026-10-11', method: 'cash' }).success, false);
});

test('subcontractor rate agreements require amount or a unit-rate formula', () => {
  const base = { projectId: '3df11457-fb93-4d68-a847-5dfe21438fe9', subcontractorId: '4680c1e2-4447-498d-8ea6-87d403287e4c', description: 'Roofing' };
  assert.equal(subcontractorAgreementSchema.safeParse({ ...base, paymentBasis: 'unit_rate', unitName: 'sq ft', rate: '850.0000' }).success, true);
  assert.equal(subcontractorAgreementSchema.safeParse({ ...base, paymentBasis: 'milestone', agreedAmount: '250000.00' }).success, true);
  assert.equal(subcontractorAgreementSchema.safeParse({ ...base, paymentBasis: 'fixed_task', agreedAmount: '250000.001' }).success, false);
});
