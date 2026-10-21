import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));
const validDate = optionalText(10).refine(v => {
  if (!v) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const date = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
}, 'Use a valid date in YYYY-MM-DD format');
const amountText = optionalText(21).refine(v => !v || /^\d{1,16}(\.\d{1,2})?$/.test(v), 'Use a valid amount with up to 2 decimal places');
const percentageText = optionalText(10).refine(v => !v || /^(100(\.0{1,4})?|\d{1,2}(\.\d{1,4})?)$/.test(v), 'Enter a percentage from 0 to 100 with up to 4 decimal places');

export const projectCreateSchema = z.object({
  projectName: z.string().trim().min(1).max(160), customerId: z.string().uuid().optional().or(z.literal('')),
  customerName: optionalText(160), customerPhone: optionalText(32), customerEmail: z.union([z.string().trim().email().max(320), z.literal('')]).optional(), customerAddress: optionalText(500),
  description: optionalText(4000), location: z.string().trim().min(1).max(240), district: optionalText(80),
  projectType: z.enum(['new_house', 'renovation', 'extension', 'commercial', 'other']),
  contractType: z.enum(['full', 'labour_only', 'hybrid']), pricingModel: z.enum(['fixed_price', 'unit_rate', 'cost_plus']),
  startDate: validDate, endDate: validDate, contractReference: optionalText(120), contractDate: validDate,
  agreedValue: amountText, contractScope: optionalText(8000), costPlusFormula: optionalText(1200),
}).superRefine((value, ctx) => {
  if (!value.customerId && !value.customerName?.trim()) ctx.addIssue({ code: 'custom', path: ['customerName'], message: 'Customer name is required' });
  if (value.startDate && value.endDate && value.endDate < value.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after start date' });
});
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const milestoneSchema = z.object({ name: z.string().trim().min(1).max(160), description: optionalText(2000), startDate: validDate, endDate: validDate, weight: amountText });
export const paymentTermSchema = z.object({ description: z.string().trim().min(1).max(240), paymentType: z.enum(['advance','milestone','progress','weekly','monthly','unit_rate','final_settlement','retention']), amount: amountText, percentage: percentageText, expectedDate: validDate, trigger: optionalText(1000), notes: optionalText(2000) }).superRefine((value, ctx) => {
  if (!value.amount && !value.percentage && !['progress','unit_rate'].includes(value.paymentType)) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Planned amount, percentage, or a variable payment type is required' });
  if (value.amount && value.percentage) ctx.addIssue({ code: 'custom', path: ['percentage'], message: 'Use planned amount or planned percentage, not both' });
});
export const scopeSchema = z.object({ description: z.string().trim().min(1).max(240), inclusion: z.enum(['included','excluded']), materialResponsibility: z.enum(['contractor','customer','third_party','not_applicable']), labourResponsibility: z.enum(['contractor','customer','third_party','not_applicable']), notes: optionalText(2000) });
export const variationSchema = z.object({ description: z.string().trim().min(1).max(2000), reason: optionalText(2000), costAdjustment: z.string().trim().regex(/^-?\d{1,16}(\.\d{1,2})?$/).optional().or(z.literal('')), scheduleDays: z.coerce.number().int().min(-3650).max(3650).optional(), notes: optionalText(2000) });
