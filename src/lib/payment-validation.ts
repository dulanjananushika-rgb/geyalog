import { z } from 'zod';
const money = z.string().trim().regex(/^\d{1,16}(\.\d{1,2})?$/, 'Amount eka 2 decimal places athule denna.');
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date eka YYYY-MM-DD format eken denna.').refine(v => {
  const parsed = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
}, 'Valid date ekak denna.');
export const receiptInputSchema = z.object({
  projectId: z.string().uuid(), amount: money, paymentDate: date,
  method: z.enum(['cash', 'bank_transfer', 'cheque', 'other']),
  category: z.enum(['advance', 'progress', 'milestone', 'partial', 'final_settlement', 'retention_release', 'other']),
  reference: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
}).transform(v => ({ ...v, verificationStatus: (v.method === 'bank_transfer' || v.method === 'cheque' ? 'pending_verification' : 'confirmed') as 'pending_verification' | 'confirmed' }));
export const obligationInputSchema = z.object({ projectId: z.string().uuid(), customerId: z.string().uuid(), description: z.string().trim().min(1).max(240), amount: money, dueDate: date.optional().or(z.literal('')), paymentTermId: z.string().uuid().optional().or(z.literal('')) });
export const allocationInputSchema = z.object({ receiptId: z.string().uuid(), items: z.array(z.object({ obligationId: z.string().uuid(), amount: money })).min(1) });
export const refundInputSchema = z.object({ receiptId: z.string().uuid(), amount: money, reason: z.string().trim().min(3).max(1000), method: z.enum(['cash', 'bank_transfer', 'cheque', 'other']) });
