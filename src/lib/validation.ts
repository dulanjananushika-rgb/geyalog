import { z } from 'zod';

const required = (label: string) => z.string().trim().min(1, `${label} is required`);
const dateString = z.string().trim().optional().or(z.literal('')).refine(
  value => {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  },
  'Use YYYY-MM-DD',
);
export const organizationSchema = z.object({ name: z.string().trim().min(2, 'Company name must be at least 2 characters').max(120, 'Company name must be 120 characters or fewer') });
export const projectSchema = z.object({
  name: required('Project name').max(160, 'Project name must be 160 characters or fewer'),
  customerName: required('Customer name').max(160, 'Customer name must be 160 characters or fewer'),
  customerContact: z.string().trim().optional().or(z.literal('')).refine(v => !v || /^[+\d][\d\s()-]{6,19}$/.test(v), 'Enter a valid phone number'),
  location: required('Location').max(240, 'Location must be 240 characters or fewer'), contractType: z.enum(['full', 'labour_only', 'hybrid']),
  pricingModel: z.enum(['fixed_price', 'unit_rate', 'cost_plus']),
  paymentArrangement: z.enum(['advance', 'progress', 'milestone', 'on_completion', 'as_agreed']),
  contractValue: z.string().trim().optional().or(z.literal('')).refine(v => !v || /^\d{1,12}(\.\d{1,2})?$/.test(v), 'Enter a valid amount (up to 2 decimal places)'),
  expectedStartDate: dateString, expectedEndDate: dateString,
}).refine(v => !v.expectedStartDate || !v.expectedEndDate || v.expectedStartDate <= v.expectedEndDate, {
  path: ['expectedEndDate'], message: 'End date must be on or after start date',
});
export type ProjectInput = z.infer<typeof projectSchema>;
