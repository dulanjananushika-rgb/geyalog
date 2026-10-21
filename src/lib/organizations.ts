import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import type { OrganizationRole } from '@/lib/permissions';

export const organizationInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  businessType: z.enum(['individual_contractor', 'construction_company']),
  phone: z.string().trim().max(32).optional().or(z.literal('')),
  email: z.union([z.string().trim().email().max(320), z.literal('')]).optional(),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  district: z.string().trim().max(80).optional().or(z.literal('')),
  registrationNumber: z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(1200).optional().or(z.literal('')),
  preferredLanguage: z.enum(['en', 'si', 'ta']),
});
export type OrganizationInput = z.infer<typeof organizationInputSchema>;
export type Organization = {
  id: string; name: string; role: OrganizationRole; status: 'active' | 'suspended' | 'removed';
  business_type: OrganizationInput['businessType']; phone: string | null; email: string | null; address: string | null;
  district: string | null; registration_number: string | null; description: string | null; preferred_language: OrganizationInput['preferredLanguage'];
};
export type OrganizationMember = { user_id: string; role: OrganizationRole; status: 'active' | 'suspended' | 'removed'; joined_at: string; profile: { full_name: string } | null };
export type OrganizationInvitation = { id: string; invited_email: string; invited_role: Exclude<OrganizationRole, 'owner' | 'viewer'>; status: string; expires_at: string; created_at: string };

function requireSupabase() {
  if (!supabase) throw new Error('Supabase setup karala app eka restart karanna.');
  return supabase;
}

export async function createOrganization(input: OrganizationInput): Promise<string> {
  const client = requireSupabase();
  const value = organizationInputSchema.parse(input);
  const { data, error } = await client.rpc('create_organization', {
    org_name: value.name,
    org_business_type: value.businessType,
    org_phone: value.phone || null,
    org_email: value.email || null,
    org_address: value.address || null,
    org_district: value.district || null,
    org_registration_number: value.registrationNumber || null,
    org_description: value.description || null,
    org_language: value.preferredLanguage,
  });
  if (error) throw error;
  return data as string;
}

export async function updateOrganization(organizationId: string, input: OrganizationInput): Promise<void> {
  const client = requireSupabase();
  const value = organizationInputSchema.parse(input);
  const { error } = await client.from('organizations').update({
    name: value.name,
    business_type: value.businessType,
    phone: value.phone || null,
    email: value.email || null,
    address: value.address || null,
    district: value.district || null,
    registration_number: value.registrationNumber || null,
    description: value.description || null,
    preferred_language: value.preferredLanguage,
  }).eq('id', organizationId);
  if (error) throw error;
}

export async function listOrganizations(): Promise<Organization[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('organization_members')
    .select('organization_id,role,status,organizations(id,name,business_type,phone,email,address,district,registration_number,description,preferred_language)')
    .eq('status', 'active').order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).flatMap(row => {
    const company = row.organizations;
    if (!company || Array.isArray(company)) return [];
    return [{ ...(company as Omit<Organization, 'role' | 'status'>), role: row.role as OrganizationRole, status: row.status as Organization['status'] }];
  });
}

export async function listOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('organization_members')
    .select('user_id,role,status,joined_at,profiles(full_name)')
    .eq('organization_id', organizationId).order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => {
    const profile = row.profiles;
    return { ...row, role: row.role as OrganizationRole, status: row.status as OrganizationMember['status'], profile: !profile || Array.isArray(profile) ? null : profile as { full_name: string } };
  });
}

export async function listOrganizationInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('organization_invitations')
    .select('id,invited_email,invited_role,status,expires_at,created_at')
    .eq('organization_id', organizationId).in('status', ['pending', 'expired']).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrganizationInvitation[];
}

export async function inviteOrganizationMember(organizationId: string, email: string, role: OrganizationInvitation['invited_role']) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('organization-invitations', {
    body: { organizationId, email: email.trim().toLowerCase(), role },
  });
  if (error) throw error;
  return data as { invitationId: string; delivery: 'sent' };
}

export async function acceptOrganizationInvitation(token: string): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('accept_organization_invitation', { raw_invitation_token: token });
  if (error) throw error;
  return data as string;
}

export async function changeMemberRole(organizationId: string, userId: string, role: Exclude<OrganizationRole, 'owner' | 'viewer'>) {
  const { error } = await requireSupabase().rpc('change_organization_member_role', {
    target_organization_id: organizationId, target_user_id: userId, new_role: role,
  });
  if (error) throw error;
}

export async function setMemberStatus(organizationId: string, userId: string, status: 'active' | 'suspended' | 'removed') {
  const { error } = await requireSupabase().rpc('set_organization_member_status', {
    target_organization_id: organizationId, target_user_id: userId, new_status: status,
  });
  if (error) throw error;
}

export async function revokeOrganizationInvitation(invitationId: string) {
  const { error } = await requireSupabase().rpc('revoke_organization_invitation', { target_invitation_id: invitationId });
  if (error) throw error;
}
