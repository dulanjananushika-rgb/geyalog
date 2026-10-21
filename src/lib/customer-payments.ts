import { supabase } from '@/lib/supabase';
import { allocationInputSchema, obligationInputSchema, receiptInputSchema, refundInputSchema } from '@/lib/payment-validation';

function db() { if (!supabase) throw new Error('Supabase connection eka configure karanna.'); return supabase; }
export type CustomerReceipt = { id: string; project_id: string; customer_id: string; receipt_number: string; amount: string; payment_date: string; payment_method: string; payment_category: string; payment_reference: string | null; notes: string | null; verification_status: string; created_at: string };
export type ObligationBalance = { organization_id: string; project_id: string; obligation_id: string; customer_id: string; description: string; due_date: string | null; original_amount: string; amount_paid: string; outstanding_amount: string; payment_status: string };
export type FinancialSummary = { original_contract_value: string | null; approved_variations: string; revised_contract_value: string | null; confirmed_receipts: string; confirmed_refunds: string; unallocated_credit: string; total_currently_due: string; outstanding_due: string; remaining_contract_value: string | null };
export function createIdempotencyKey() { return `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`; }

export async function recordCustomerReceipt(organizationId: string, customerId: string, input: unknown, idempotencyKey: string) {
  const value = receiptInputSchema.parse(input);
  const { data, error } = await db().rpc('record_customer_receipt', {
    target_organization_id: organizationId, target_project_id: value.projectId, target_customer_id: customerId,
    receipt_amount: value.amount, receipt_date: value.paymentDate, receipt_method: value.method,
    receipt_category: value.category, receipt_reference: value.reference || null, receipt_notes: value.notes || null,
    receipt_status: value.verificationStatus, request_idempotency_key: idempotencyKey, allocation_items: [],
  });
  if (error) throw error;
  return data as string;
}

export async function createCustomerObligation(organizationId: string, input: unknown) {
  const value = obligationInputSchema.parse(input);
  const { data, error } = await db().from('customer_payment_obligations').insert({ organization_id: organizationId, project_id: value.projectId, customer_id: value.customerId, payment_term_id: value.paymentTermId || null, description: value.description, amount: value.amount, due_date: value.dueDate || null }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function listCustomerReceipts(organizationId: string, projectId?: string): Promise<CustomerReceipt[]> {
  let query = db().from('customer_receipts').select('id,project_id,customer_id,receipt_number,amount,payment_date,payment_method,payment_category,payment_reference,notes,verification_status,created_at').eq('organization_id', organizationId).order('payment_date', { ascending: false }).limit(100);
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CustomerReceipt[];
}

export async function getReceipt(organizationId: string, receiptId: string): Promise<CustomerReceipt> {
  const { data, error } = await db().from('customer_receipts').select('id,project_id,customer_id,receipt_number,amount,payment_date,payment_method,payment_category,payment_reference,notes,verification_status,created_at').eq('organization_id', organizationId).eq('id', receiptId).single();
  if (error) throw error;
  return data as CustomerReceipt;
}

export async function listObligationBalances(organizationId: string, projectId?: string): Promise<ObligationBalance[]> {
  const { data, error } = await db().rpc('customer_obligation_balances');
  if (error) throw error;
  const rows = (data ?? []) as ObligationBalance[];
  return rows.filter(row => row.organization_id === organizationId && (!projectId || row.project_id === projectId));
}

export async function getProjectFinancialSummary(organizationId: string, projectId: string): Promise<FinancialSummary | null> {
  const { data, error } = await db().rpc('customer_project_financial_summary', { target_organization_id: organizationId, target_project_id: projectId });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as FinancialSummary | null;
}

export async function allocateCustomerReceipt(input: unknown) {
  const value = allocationInputSchema.parse(input);
  const { error } = await db().rpc('allocate_customer_receipt', { target_receipt_id: value.receiptId, allocation_items: value.items });
  if (error) throw error;
}

export async function confirmCustomerReceipt(receiptId: string) {
  const { error } = await db().rpc('confirm_customer_receipt', { target_receipt_id: receiptId });
  if (error) throw error;
}

export async function refundCustomerReceipt(input: unknown) {
  const value = refundInputSchema.parse(input);
  const status = value.method === 'bank_transfer' || value.method === 'cheque' ? 'pending_verification' : 'confirmed';
  const { data, error } = await db().rpc('record_customer_refund', { target_receipt_id: value.receiptId, refund_amount: value.amount, refund_reason: value.reason, refund_method: value.method, refund_status: status });
  if (error) throw error;
  return data as string;
}

export async function reverseCustomerReceipt(receiptId: string, reason: string) {
  if (reason.trim().length < 3) throw new Error('Reversal reason eka required.');
  const { error } = await db().rpc('reverse_customer_receipt', { target_receipt_id: receiptId, reason: reason.trim() });
  if (error) throw error;
}
