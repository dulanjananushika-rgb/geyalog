import { supabase } from '@/lib/supabase';
import { projectCreateSchema, milestoneSchema, paymentTermSchema, scopeSchema, variationSchema, type ProjectCreateInput } from '@/lib/project-validation';
import { z } from 'zod';

export type ProjectListItem = { id: string; organization_id: string; name: string; project_reference: string; customer_name: string; customer_contact: string | null; customer_id: string; location: string; district: string | null; project_type: string; contract_type: string; pricing_model: string; status: string; expected_start_date: string | null; expected_end_date: string | null };
export type ProjectOverview = ProjectListItem & {
  contract: { contract_reference: string | null; contract_date: string | null; agreed_value: string | null; approved_variation_total: string; revised_agreed_value: string | null; currency_code: string; cost_plus_formula: string | null; status: string } | null;
  milestones: { id: string; name: string; position: number; planned_start_date: string | null; planned_end_date: string | null; weight: string | null }[];
  paymentTerms: { id: string; description: string; payment_type: string; planned_amount: string | null; planned_percentage: string | null; expected_date: string | null; trigger_condition: string | null }[];
  scope: { id: string; description: string; inclusion: string; material_responsibility: string; labour_responsibility: string; notes: string | null }[];
  variations: { id: string; variation_reference: string; description: string; proposed_cost_adjustment: string | null; proposed_schedule_days: number | null; status: string; created_by: string; approved_at: string | null }[];
};

function db() { if (!supabase) throw new Error('Supabase connect karala app eka restart karanna.'); return supabase; }

export async function createProjectWithContract(organizationId: string, input: ProjectCreateInput) {
  const value = projectCreateSchema.parse(input);
  const { data, error } = await db().rpc('create_project_with_contract', {
    target_organization_id: organizationId, target_customer_id: value.customerId || null,
    customer_name_input: value.customerName || null, customer_phone_input: value.customerPhone || null,
    customer_email_input: value.customerEmail || null, customer_address_input: value.customerAddress || null,
    project_name_input: value.projectName, project_description_input: value.description || null,
    project_location_input: value.location, project_district_input: value.district || null,
    project_type_input: value.projectType, project_contract_type_input: value.contractType,
    project_pricing_model_input: value.pricingModel, project_start_input: value.startDate || null,
    project_end_input: value.endDate || null, contract_reference_input: value.contractReference || null,
    contract_date_input: value.contractDate || null, agreed_value_input: value.agreedValue || null,
    contract_scope_input: value.contractScope || null, cost_plus_formula_input: value.costPlusFormula || null,
  });
  if (error) throw error;
  return data as string;
}

export async function listCompanyProjects(organizationId: string, search = ''): Promise<ProjectListItem[]> {
  const query = db().from('projects').select('id,organization_id,name,project_reference,customer_name,customer_contact,customer_id,location,district,project_type,contract_type,pricing_model,status,expected_start_date,expected_end_date').eq('organization_id', organizationId).order('created_at', { ascending: false });
  const { data, error } = await (search.trim() ? query.or(`name.ilike.%${search.trim()}%,customer_name.ilike.%${search.trim()}%,project_reference.ilike.%${search.trim()}%`) : query);
  if (error) throw error;
  return (data ?? []) as ProjectListItem[];
}

export async function getProjectOverview(organizationId: string, projectId: string): Promise<ProjectOverview> {
  const client = db();
  const [project, contract, milestones, paymentTerms, scope, variations] = await Promise.all([
    client.from('projects').select('id,organization_id,name,project_reference,customer_name,customer_contact,customer_id,location,district,project_type,contract_type,pricing_model,status,expected_start_date,expected_end_date').eq('organization_id', organizationId).eq('id', projectId).single(),
    client.from('project_contract_summary').select('contract_reference,contract_date,agreed_value,approved_variation_total,revised_agreed_value,currency_code,cost_plus_formula,status').eq('organization_id', organizationId).eq('project_id', projectId).maybeSingle(),
    client.from('project_milestones').select('id,name,position,planned_start_date,planned_end_date,weight').eq('organization_id', organizationId).eq('project_id', projectId).order('position'),
    client.from('project_payment_terms').select('id,description,payment_type,planned_amount,planned_percentage,expected_date,trigger_condition').eq('organization_id', organizationId).eq('project_id', projectId).order('sequence'),
    client.from('project_scope_items').select('id,description,inclusion,material_responsibility,labour_responsibility,notes').eq('organization_id', organizationId).eq('project_id', projectId).order('position'),
    client.from('project_variations').select('id,variation_reference,description,proposed_cost_adjustment,proposed_schedule_days,status,created_by,approved_at').eq('organization_id', organizationId).eq('project_id', projectId).order('created_at', { ascending: false }),
  ]);
  for (const error of [project.error, contract.error, milestones.error, paymentTerms.error, scope.error, variations.error]) if (error) throw error;
  return { ...project.data, contract: contract.data, milestones: milestones.data ?? [], paymentTerms: paymentTerms.data ?? [], scope: scope.data ?? [], variations: variations.data ?? [] } as ProjectOverview;
}

export async function updateProjectStatus(organizationId: string, projectId: string, status: ProjectListItem['status']) {
  const { error } = await db().from('projects').update({ status }).eq('organization_id', organizationId).eq('id', projectId);
  if (error) throw error;
}

export async function addMilestone(organizationId: string, projectId: string, input: z.infer<typeof milestoneSchema>, position: number) {
  const v = milestoneSchema.parse(input);
  const { error } = await db().from('project_milestones').insert({ organization_id: organizationId, project_id: projectId, name: v.name, description: v.description || null, position, planned_start_date: v.startDate || null, planned_end_date: v.endDate || null, weight: v.weight || null });
  if (error) throw error;
}

export async function addPaymentTerm(organizationId: string, projectId: string, input: z.infer<typeof paymentTermSchema>, sequence: number) {
  const v = paymentTermSchema.parse(input);
  const { error } = await db().from('project_payment_terms').insert({ organization_id: organizationId, project_id: projectId, description: v.description, payment_type: v.paymentType, planned_amount: v.amount || null, planned_percentage: v.percentage || null, expected_date: v.expectedDate || null, trigger_condition: v.trigger || null, notes: v.notes || null, sequence });
  if (error) throw error;
}

export async function addProjectScope(organizationId: string, projectId: string, input: z.infer<typeof scopeSchema>, position: number) {
  const v = scopeSchema.parse(input);
  const { error } = await db().from('project_scope_items').insert({ organization_id: organizationId, project_id: projectId, description: v.description, inclusion: v.inclusion, material_responsibility: v.materialResponsibility, labour_responsibility: v.labourResponsibility, notes: v.notes || null, position });
  if (error) throw error;
}

export async function createProjectVariation(organizationId: string, projectId: string, input: z.infer<typeof variationSchema>) {
  const v = variationSchema.parse(input);
  const { error } = await db().from('project_variations').insert({ organization_id: organizationId, project_id: projectId, description: v.description, reason: v.reason || null, proposed_cost_adjustment: v.costAdjustment || null, proposed_schedule_days: v.scheduleDays ?? null, status: 'draft' });
  if (error) throw error;
}

export async function submitProjectVariation(organizationId: string, variationId: string) {
  const { error } = await db().from('project_variations').update({ status: 'submitted' }).eq('organization_id', organizationId).eq('id', variationId).eq('status', 'draft');
  if (error) throw error;
}

export async function decideProjectVariation(variationId: string, decision: 'approved' | 'rejected', notes?: string) {
  const { error } = await db().rpc('decide_project_variation', { target_variation_id: variationId, decision, decision_notes: notes || null });
  if (error) throw error;
}
