import { z } from 'zod';

const email = z.string().trim().email('Valid email address ekak enter karanna.').transform(value => value.toLowerCase());
const password = z.string().min(8, 'Password eka characters 8k ho eeta wada wenna one.').max(72, 'Password eka godak diga wadi.');

export const signInSchema = z.object({ email, password: z.string().min(1, 'Password eka enter karanna.') });
export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name eka characters 2k ho eeta wada wenna one.').max(120, 'Full name eka characters 120ta adu wenna one.'),
  email,
  password,
  confirmPassword: z.string(),
}).refine(value => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords dekama match wenne naha.' });
export const emailSchema = z.object({ email });
export const resetPasswordSchema = z.object({ password, confirmPassword: z.string() })
  .refine(value => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords dekama match wenne naha.' });
export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name eka characters 2k ho eeta wada wenna one.').max(120, 'Full name eka characters 120ta adu wenna one.'),
  preferredLanguage: z.enum(['en', 'si', 'ta']),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
