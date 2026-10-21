import assert from 'node:assert/strict';
import test from 'node:test';
import { invitationSchema, organizationSchema } from '../src/lib/organization-validation.ts';
import { hasPermission } from '../src/lib/permissions.ts';

const base = {
  name: '  Demo Construction  ', businessType: 'individual_contractor', preferredLanguage: 'si',
  phone: '', email: '', address: '', district: '', registrationNumber: '', description: '',
};

test('company onboarding validates essentials while keeping small-contractor details optional', () => {
  const parsed = organizationSchema.safeParse(base);
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.name, 'Demo Construction');
  assert.equal(organizationSchema.safeParse({ ...base, name: ' ' }).success, false);
  assert.equal(organizationSchema.safeParse({ ...base, businessType: '' }).success, false);
  assert.equal(organizationSchema.safeParse({ ...base, preferredLanguage: '' }).success, false);
  assert.equal(organizationSchema.safeParse({ ...base, registrationNumber: 'x'.repeat(81) }).success, false);
});

test('company details validate Sri Lankan contact and district fields', () => {
  assert.equal(organizationSchema.safeParse({ ...base, phone: '0771234567', email: 'builder@example.lk', district: 'Colombo' }).success, true);
  assert.equal(organizationSchema.safeParse({ ...base, phone: 'not a phone' }).success, false);
  assert.equal(organizationSchema.safeParse({ ...base, email: 'not-an-email' }).success, false);
  assert.equal(organizationSchema.safeParse({ ...base, district: 'Outside Sri Lanka' }).success, false);
});

test('invitations accept valid email and supported membership roles only', () => {
  assert.equal(invitationSchema.safeParse({ email: 'staff@example.lk', role: 'site_supervisor' }).success, true);
  assert.equal(invitationSchema.safeParse({ email: 'bad-email', role: 'accountant' }).success, false);
  assert.equal(invitationSchema.safeParse({ email: 'staff@example.lk', role: 'global_admin' }).success, false);
});

test('central permissions enforce role boundaries correctly', () => {
  assert.equal(hasPermission('owner', 'company', 'update'), true);
  assert.equal(hasPermission('admin', 'company', 'manageTeam'), true);
  assert.equal(hasPermission('viewer', 'company', 'manageTeam'), false);
  assert.equal(hasPermission('site_supervisor', 'materials', 'read'), true);
  assert.equal(hasPermission('site_supervisor', 'materials', 'approveOrders'), false);
  assert.equal(hasPermission('accountant', 'customerPayments', 'manage'), true);
  assert.equal(hasPermission('site_supervisor', 'customerPayments', 'manage'), false);
});
