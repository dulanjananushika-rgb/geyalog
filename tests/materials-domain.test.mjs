import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseOrderSchema, requisitionSchema, supplierInvoiceSchema, supplierPaymentSchema } from '../src/lib/materials-validation.ts';

test('purchase order keeps quantity and unit cost as decimal strings', () => {
  const value = { supplierId: '3df11457-fb93-4d68-a847-5dfe21438fe9', orderDate: '2026-10-11', lines: [{ materialId: '4680c1e2-4447-498d-8ea6-87d403287e4c', quantity: '12.1250', unitCost: '390.2500' }] };
  const result = purchaseOrderSchema.safeParse(value);
  assert.equal(result.success, true);
  assert.equal(result.data.lines[0].unitCost, '390.2500');
});

test('purchase order rejects reversed delivery dates and invalid precision', () => {
  const base = { supplierId: '3df11457-fb93-4d68-a847-5dfe21438fe9', orderDate: '2026-10-11', lines: [{ materialId: '4680c1e2-4447-498d-8ea6-87d403287e4c', quantity: '12.12345', unitCost: '390.25' }] };
  assert.equal(purchaseOrderSchema.safeParse({ ...base, expectedDate: '2026-10-10' }).success, false);
  assert.equal(purchaseOrderSchema.safeParse(base).success, false);
});

test('purchase orders linked to requisitions must reference the exact approved line', () => {
  const base = { supplierId: '3df11457-fb93-4d68-a847-5dfe21438fe9', requisitionId: 'c84b221b-8b77-4bd4-8a32-3bcd311d6921', orderDate: '2026-10-11', lines: [{ materialId: '4680c1e2-4447-498d-8ea6-87d403287e4c', quantity: '2.00', unitCost: '100.00' }] };
  assert.equal(purchaseOrderSchema.safeParse(base).success, false);
  assert.equal(purchaseOrderSchema.safeParse({ ...base, lines: [{ ...base.lines[0], requisitionLineId: 'da45c31e-2e2a-4e31-a1d7-58d284f111a4' }] }).success, true);
});

test('supplier invoice and payment dates and amounts are validated', () => {
  const supplierId = '3df11457-fb93-4d68-a847-5dfe21438fe9';
  assert.equal(supplierInvoiceSchema.safeParse({ supplierId, invoiceNumber: 'INV-01', invoiceDate: '2026-10-11', dueDate: '2026-10-12', amount: '100000.00' }).success, true);
  assert.equal(supplierInvoiceSchema.safeParse({ supplierId, invoiceNumber: 'INV-01', invoiceDate: '2026-10-11', dueDate: '2026-10-10', amount: '100000.00' }).success, false);
  assert.equal(supplierPaymentSchema.safeParse({ supplierId, amount: '100.001', paymentDate: '2026-10-11', method: 'cash' }).success, false);
});

test('material requisition validates project, material and positive decimal quantities', () => {
  const value = { projectId: '3df11457-fb93-4d68-a847-5dfe21438fe9', lines: [{ materialId: '4680c1e2-4447-498d-8ea6-87d403287e4c', quantity: '12.1250' }] };
  assert.equal(requisitionSchema.safeParse(value).success, true);
  assert.equal(requisitionSchema.safeParse({ ...value, lines: [{ ...value.lines[0], quantity: '0' }] }).success, false);
  assert.equal(requisitionSchema.safeParse({ ...value, lines: [] }).success, false);
});
