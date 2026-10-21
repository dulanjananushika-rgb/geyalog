import { z } from 'zod';

export const districts = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle',
  'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle',
  'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala',
  'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura',
  'Trincomalee', 'Vavuniya',
] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));
const optionalPhone = optionalText(32).refine(value => !value || /^\+?[0-9][0-9\s()-]{6,19}$/.test(value), 'Enter a valid phone number');

export const organizationSchema = z.object({
  name: z.string().trim().min(2, 'Company name must be at least 2 characters').max(120, 'Company name must be 120 characters or fewer'),
  businessType: z.enum(['', 'individual_contractor', 'construction_company']).refine(value => value !== '', 'Choose a business type'),
  phone: optionalPhone,
  email: z.string().trim().optional().or(z.literal('')).refine(value => !value || z.email().safeParse(value).success, 'Enter a valid email address'),
  address: optionalText(240),
  district: z.enum(districts).optional().or(z.literal('')),
  registrationNumber: optionalText(80),
  description: optionalText(1000),
  preferredLanguage: z.enum(['', 'en', 'si', 'ta']).refine(value => value !== '', 'Choose a language'),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
export type OrganizationFormValues = z.input<typeof organizationSchema>;
export type OrganizationBusinessType = OrganizationInput['businessType'];
export type OrganizationLanguage = OrganizationInput['preferredLanguage'];

export const invitationSchema = z.object({
  email: z.email('Enter a valid email address').trim().max(254),
  role: z.enum(['owner', 'admin', 'site_supervisor', 'accountant']),
});
export type InvitationInput = z.infer<typeof invitationSchema>;

export const roleLabels: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', site_supervisor: 'Site Supervisor', accountant: 'Accountant', legacy_viewer: 'Legacy viewer',
};
