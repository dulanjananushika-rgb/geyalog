import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentTermSchema, projectCreateSchema, scopeSchema, variationSchema } from '../src/lib/project-validation.ts';

const baseProject = {
  projectName: 'House project', customerName: 'Nimal Perera', customerPhone: '', customerEmail: '', customerAddress: '',
  description: '', location: 'Gampaha', district: 'Gampaha', projectType: 'new_house', contractType: 'full',
  pricingModel: 'fixed_price', startDate: '', endDate: '', contractReference: '', contractDate: '',
  agreedValue: '', contractScope: '', costPlusFormula: '',
};

test('unit-rate and cost-plus drafts do not require a guaranteed final value', () => {
  assert.equal(projectCreateSchema.safeParse({ ...baseProject, pricingModel: 'unit_rate' }).success, true);
  assert.equal(projectCreateSchema.safeParse({ ...baseProject, pricingModel: 'cost_plus' }).success, true);
});

test('project form rejects impossible dates and reversed timeline', () => {
  assert.equal(projectCreateSchema.safeParse({ ...baseProject, startDate: '2026-02-30' }).success, false);
  assert.equal(projectCreateSchema.safeParse({ ...baseProject, startDate: '2026-12-10', endDate: '2026-12-09' }).success, false);
});

test('payment terms support variable schedules and prevent amount-plus-percentage ambiguity', () => {
  assert.equal(paymentTermSchema.safeParse({ description: 'Measured work', paymentType: 'unit_rate', amount: '', percentage: '' }).success, true);
  assert.equal(paymentTermSchema.safeParse({ description: 'Advance', paymentType: 'advance', amount: '100000.25', percentage: '' }).success, true);
  assert.equal(paymentTermSchema.safeParse({ description: 'Installment', paymentType: 'milestone', amount: '1000', percentage: '20' }).success, false);
  assert.equal(paymentTermSchema.safeParse({ description: 'Installment', paymentType: 'milestone', amount: '', percentage: '120' }).success, false);
});

test('scope responsibility is independent for materials and labour', () => {
  const scope = scopeSchema.safeParse({ description: 'Electrical', inclusion: 'included', materialResponsibility: 'customer', labourResponsibility: 'contractor', notes: '' });
  assert.equal(scope.success, true);
});

test('variation amounts use decimal strings and accept omitted-work credits', () => {
  assert.equal(variationSchema.safeParse({ description: 'Remove omitted tiling', costAdjustment: '-1250.50' }).success, true);
  assert.equal(variationSchema.safeParse({ description: 'Add balcony', costAdjustment: '1.234' }).success, false);
});
