import { supabase } from '@/lib/supabase';
import type { ProjectInput } from '@/lib/validation';

export type Project = {
  id: string; name: string; customer_name: string; customer_contact: string | null;
  location: string; contract_type: ProjectInput['contractType']; pricing_model: ProjectInput['pricingModel'];
  payment_arrangement: ProjectInput['paymentArrangement'];
  expected_start_date: string | null; expected_end_date: string | null;
};

export async function listProjects(organizationId: string): Promise<Project[]> {
  if (!supabase) throw new Error('Supabase is not configured. Add the environment variables and restart Expo.');
  const { data, error } = await supabase.from('projects').select('id,name,customer_name,customer_contact,location,contract_type,pricing_model,payment_arrangement,expected_start_date,expected_end_date').eq('organization_id', organizationId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function createProject(organizationId: string, input: ProjectInput): Promise<Project> {
  if (!supabase) throw new Error('Supabase is not configured. Add the environment variables and restart Expo.');
  const { data, error } = await supabase.from('projects').insert({
    organization_id: organizationId, name: input.name.trim(), customer_name: input.customerName.trim(),
    customer_contact: input.customerContact?.trim() || null, location: input.location.trim(),
    contract_type: input.contractType, pricing_model: input.pricingModel,
    payment_arrangement: input.paymentArrangement,
    contract_value: input.contractValue?.trim() || null,
    expected_start_date: input.expectedStartDate || null, expected_end_date: input.expectedEndDate || null,
  }).select('id,name,customer_name,customer_contact,location,contract_type,pricing_model,payment_arrangement,expected_start_date,expected_end_date').single();
  if (error) throw error;
  return data as Project;
}
