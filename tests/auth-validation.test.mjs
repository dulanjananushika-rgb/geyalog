import assert from 'node:assert/strict';
import test from 'node:test';
import { emailSchema, profileSchema, resetPasswordSchema, signInSchema, signUpSchema } from '../src/lib/auth-validation.ts';

test('sign-in validates email and requires a password', () => {
  assert.equal(signInSchema.safeParse({ email: '  BUILDER@example.com ', password: 'secret' }).data.email, 'builder@example.com');
  assert.equal(signInSchema.safeParse({ email: 'not-an-email', password: 'secret' }).success, false);
  assert.equal(signInSchema.safeParse({ email: 'builder@example.com', password: '' }).success, false);
});

test('sign-up requires a full name, valid email, secure-length password and matching confirmation', () => {
  const valid = { fullName: '  Nimal Perera ', email: ' NIMAL@example.com ', password: 'strong-pass-1', confirmPassword: 'strong-pass-1' };
  assert.equal(signUpSchema.safeParse(valid).success, true);
  assert.equal(signUpSchema.safeParse({ ...valid, email: 'wrong' }).success, false);
  assert.equal(signUpSchema.safeParse({ ...valid, password: 'short' }).success, false);
  assert.equal(signUpSchema.safeParse({ ...valid, confirmPassword: 'different-pass' }).success, false);
});

test('password reset requires a matching new password and confirmation', () => {
  assert.equal(resetPasswordSchema.safeParse({ password: 'new-password-1', confirmPassword: 'new-password-1' }).success, true);
  assert.equal(resetPasswordSchema.safeParse({ password: 'new-password-1', confirmPassword: 'other-password' }).success, false);
});

test('profile schema only allows supported language codes', () => {
  assert.equal(profileSchema.safeParse({ fullName: 'Nimal Perera', preferredLanguage: 'si' }).success, true);
  assert.equal(profileSchema.safeParse({ fullName: 'Nimal Perera', preferredLanguage: 'fr' }).success, false);
  assert.equal(emailSchema.safeParse({ email: 'no-at-sign' }).success, false);
});
