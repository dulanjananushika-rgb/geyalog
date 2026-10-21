import { supabase } from '@/lib/supabase';
import { attendanceSchema, labourAdvanceSchema, labourTaskProgressSchema, labourTaskSchema, settlementPaymentSchema, settlementPeriodSchema, subcontractorAgreementSchema, subcontractorPaymentSchema, subcontractorSchema, subcontractorWorkSchema, workerAssignmentSchema, workerRateSchema, workerSchema, type AttendanceInput, type LabourAdvanceInput, type LabourTaskInput, type LabourTaskProgressInput, type SettlementPaymentInput, type SettlementPeriodInput, type SubcontractorAgreementInput, type SubcontractorInput, type SubcontractorPaymentInput, type SubcontractorWorkInput, type WorkerAssignmentInput, type WorkerInput, type WorkerRateInput } from '@/lib/workforce-validation';

function db() { if (!supabase) throw new Error('Supabase connection eka configure karala app eka restart karanna.'); return supabase; }
export type Worker = { id: string; full_name: string; phone: string | null; skill_category: string; engagement_type: string; status: string };
export type WorkerAssignment = { id: string; worker_id: string; project_id: string; work_role: string; start_date: string; earning_method: string; payment_schedule: string; status: string; worker: Worker; project: { name: string } };
export type AttendanceRecord = { id: string; worker_id: string; worker_assignment_id: string; attendance_status: string; hours_worked: string | null; day_fraction: string; approval_status: string; notes: string | null; worker: { full_name: string; skill_category: string } | null };
export type LabourAdvance = { id:string;project_id:string;worker_id:string;assignment_id:string|null;amount:string;payment_date:string;payment_method:string;status:string;reference:string|null;notes:string|null };
export type LabourSettlement = { id:string;project_id:string;worker_id:string;assignment_id:string;period_start:string;period_end:string;gross_earned:string;advance_offset:string;status:string };
export type LabourPayment = { id:string;worker_id:string|null;subcontractor_id:string|null;settlement_id:string|null;subcontractor_work_record_id:string|null;payment_amount:string;payment_date:string;payment_method:string;payment_purpose:string;status:string;reference:string|null;notes:string|null };
export type LabourTask = { id:string;project_id:string;assignment_id:string;task_name:string;payment_basis:string;unit_name:string|null;unit_rate:string|null;fixed_amount:string|null;estimated_quantity:string|null;status:string };
export type LabourTaskProgress = { id:string;task_id:string;reported_quantity:string;approved_quantity:string|null;progress_date:string;status:string;notes:string|null };
export type Subcontractor = { id:string;business_name:string;contact_name:string|null;phone:string|null;email:string|null;status:string };
export type SubcontractorAgreement = { id:string;project_id:string;subcontractor_id:string;description:string;payment_basis:string;unit_name:string|null;rate:string|null;agreed_amount:string|null;status:string };
export type SubcontractorWork = { id:string;project_id:string;agreement_id:string;work_date:string;reported_quantity:string|null;approved_quantity:string|null;agreed_amount:string|null;approved_amount:string|null;status:string };
export type LabourProjectSummary = { earned_labour_cost:string;confirmed_payment_outflow:string;pending_payment_amount:string;confirmed_advance_outflow:string;unrecovered_advances:string;subcontractor_advances_outstanding:string;earned_balance_payable:string };
export type WorkerHistoryEntry = { record_type:string;record_date:string;amount:string|null;status:string;details:string;project_id:string };

export async function listWorkers(organizationId: string): Promise<Worker[]> {
  const { data, error } = await db().from('workers').select('id,full_name,phone,skill_category,engagement_type,status').eq('organization_id', organizationId).order('full_name');
  if (error) throw error;
  return (data ?? []) as Worker[];
}

export async function createWorker(organizationId: string, input: WorkerInput) {
  const value = workerSchema.parse(input);
  const { data, error } = await db().from('workers').insert({
    organization_id: organizationId, full_name: value.fullName, phone: value.phone || null,
    skill_category: value.skillCategory, engagement_type: value.engagementType, notes: value.notes || null,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function listWorkerAssignments(organizationId: string, projectId?: string): Promise<WorkerAssignment[]> {
  let query = db().from('worker_project_assignments').select('id,worker_id,project_id,work_role,start_date,earning_method,payment_schedule,status,worker:workers(id,full_name,phone,skill_category,engagement_type,status),project:projects(name)').eq('organization_id', organizationId).eq('status', 'active').order('start_date', { ascending: false });
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as WorkerAssignment[];
}

export async function assignWorker(organizationId: string, input: WorkerAssignmentInput) {
  const value = workerAssignmentSchema.parse(input);
  const { data, error } = await db().rpc('assign_project_worker', {
    target_organization_id: organizationId, target_project_id: value.projectId,
    target_worker_id: value.workerId, assignment_role: value.workRole,
    assignment_start_date: value.startDate, target_earning_method: value.earningMethod,
    target_payment_schedule: value.paymentSchedule, target_rate: value.rate,
    target_unit_name: value.unitName || null, target_half_day_factor: value.halfDayFactor,
    target_rate_effective_from: value.effectiveFrom, target_weekly_work_days: value.weeklyWorkDays,
  });
  if (error) throw error;
  return data as string;
}
export async function addWorkerRate(organizationId:string,input:WorkerRateInput){const value=workerRateSchema.parse(input);const {data,error}=await db().rpc('add_worker_rate_agreement',{target_organization_id:organizationId,target_assignment_id:value.assignmentId,target_method:value.earningMethod,target_rate:value.rate,target_unit:value.unitName||null,target_half_day_factor:value.halfDayFactor,target_weekly_work_days:value.weeklyWorkDays,target_effective_from:value.effectiveFrom,target_notes:value.notes||null});if(error)throw error;return data as string;}
export async function listLabourTasks(organizationId:string,projectId?:string):Promise<LabourTask[]>{let query=db().from('labour_tasks').select('id,project_id,assignment_id,task_name,payment_basis,unit_name,unit_rate,fixed_amount,estimated_quantity,status').eq('organization_id',organizationId).order('created_at',{ascending:false});if(projectId)query=query.eq('project_id',projectId);const {data,error}=await query;if(error)throw error;return (data??[]) as LabourTask[];}
export async function listTaskProgress(organizationId:string,taskId?:string):Promise<LabourTaskProgress[]>{let query=db().from('labour_task_progress').select('id,task_id,reported_quantity,approved_quantity,progress_date,status,notes').eq('organization_id',organizationId).order('progress_date',{ascending:false}).limit(100);if(taskId)query=query.eq('task_id',taskId);const {data,error}=await query;if(error)throw error;return (data??[]) as LabourTaskProgress[];}
export async function createLabourTask(organizationId:string,input:LabourTaskInput){const v=labourTaskSchema.parse(input);const {data,error}=await db().from('labour_tasks').insert({organization_id:organizationId,project_id:v.projectId,assignment_id:v.assignmentId,task_name:v.taskName,payment_basis:v.paymentBasis,unit_name:v.unitName,unit_rate:v.paymentBasis==='unit_rate'?v.unitRate:null,fixed_amount:v.paymentBasis==='fixed_task'?v.fixedAmount:null,estimated_quantity:v.estimatedQuantity||null,status:'active'}).select('id').single();if(error)throw error;return data.id as string;}
export async function submitLabourTaskProgress(organizationId:string,projectId:string,input:LabourTaskProgressInput){const v=labourTaskProgressSchema.parse(input);const {data,error}=await db().from('labour_task_progress').insert({organization_id:organizationId,project_id:projectId,task_id:v.taskId,reported_quantity:v.quantity,progress_date:v.progressDate,notes:v.notes||null,status:'submitted'}).select('id').single();if(error)throw error;return data.id as string;}
export async function approveLabourTaskProgress(id:string){const {error}=await db().rpc('approve_labour_task_progress',{target_progress_id:id});if(error)throw error;}
export async function listSubcontractors(organizationId:string):Promise<Subcontractor[]>{const {data,error}=await db().from('subcontractors').select('id,business_name,contact_name,phone,email,status').eq('organization_id',organizationId).eq('status','active').order('business_name');if(error)throw error;return (data??[]) as Subcontractor[];}
export async function createSubcontractor(organizationId:string,input:SubcontractorInput){const v=subcontractorSchema.parse(input);const {data,error}=await db().from('subcontractors').insert({organization_id:organizationId,business_name:v.businessName,contact_name:v.contactName||null,phone:v.phone||null,email:v.email||null,address:v.address||null}).select('id').single();if(error)throw error;return data.id as string;}
export async function listSubcontractorAgreements(organizationId:string,projectId?:string):Promise<SubcontractorAgreement[]>{let query=db().from('subcontractor_agreements').select('id,project_id,subcontractor_id,description,payment_basis,unit_name,rate,agreed_amount,status').eq('organization_id',organizationId).order('created_at',{ascending:false});if(projectId)query=query.eq('project_id',projectId);const {data,error}=await query;if(error)throw error;return (data??[]) as SubcontractorAgreement[];}
export async function createSubcontractorAgreement(organizationId:string,input:SubcontractorAgreementInput){const v=subcontractorAgreementSchema.parse(input);const {data,error}=await db().rpc('create_subcontractor_agreement',{target_organization_id:organizationId,target_project_id:v.projectId,target_subcontractor_id:v.subcontractorId,agreement_description:v.description,target_payment_basis:v.paymentBasis,target_unit_name:v.unitName||null,target_rate:v.rate||null,target_agreed_amount:v.agreedAmount||null,target_start_date:v.startDate||null,target_end_date:v.endDate||null});if(error)throw error;return data as string;}
export async function listSubcontractorWork(organizationId:string,projectId?:string):Promise<SubcontractorWork[]>{let query=db().from('subcontractor_work_records').select('id,project_id,agreement_id,work_date,reported_quantity,approved_quantity,agreed_amount,approved_amount,status').eq('organization_id',organizationId).order('work_date',{ascending:false}).limit(100);if(projectId)query=query.eq('project_id',projectId);const {data,error}=await query;if(error)throw error;return (data??[]) as SubcontractorWork[];}
export async function submitSubcontractorWork(organizationId:string,projectId:string,input:SubcontractorWorkInput){const v=subcontractorWorkSchema.parse(input);const {data,error}=await db().rpc('submit_subcontractor_work',{target_organization_id:organizationId,target_project_id:projectId,target_agreement_id:v.agreementId,target_work_date:v.workDate,target_reported_quantity:v.quantity||null,target_requested_amount:v.requestedAmount||null});if(error)throw error;return data as string;}
export async function approveSubcontractorWork(id:string,quantity:string,amount:string){const {error}=await db().rpc('approve_subcontractor_work',{target_work_record_id:id,target_approved_quantity:quantity||null,target_approved_amount:amount||null});if(error)throw error;}
export async function recordSubcontractorPayment(input:SubcontractorPaymentInput,requestKey:string){const v=subcontractorPaymentSchema.parse(input);const {data,error}=await db().rpc('record_subcontractor_payment',{target_work_record_id:v.workRecordId,payment_amount:v.amount,payment_date:v.paymentDate,payment_method:v.method,payment_reference:v.reference||null,payment_notes:v.notes||null,request_key:requestKey});if(error)throw error;return data as string;}
export async function recordSubcontractorAdvance(organizationId:string,projectId:string,subcontractorId:string,amount:string,paymentDate:string,method:'cash'|'bank_transfer'|'cheque'|'other',reference:string,notes:string,requestKey:string){if(!/^\d{1,14}(\.\d{1,2})?$/.test(amount)||Number(amount)<=0)throw new Error('Advance amount eka decimals 2 ta yatin danna.');const {data,error}=await db().rpc('record_subcontractor_advance',{target_organization_id:organizationId,target_project_id:projectId,target_subcontractor_id:subcontractorId,payment_amount:amount,payment_date:paymentDate,payment_method:method,payment_reference:reference||null,payment_notes:notes||null,request_key:requestKey});if(error)throw error;return data as string;}
export async function confirmSubcontractorPayment(id:string){const {error}=await db().rpc('confirm_subcontractor_payment',{target_payment_id:id});if(error)throw error;}
export async function reverseSubcontractorPayment(id:string,reason:string){if(reason.trim().length<3)throw new Error('Reversal reason eka danna.');const {error}=await db().rpc('reverse_subcontractor_payment',{target_payment_id:id,reason:reason.trim()});if(error)throw error;}
export async function getLabourProjectSummary(organizationId:string,projectId:string):Promise<LabourProjectSummary>{const {data,error}=await db().rpc('get_labour_project_cost_summary',{target_organization_id:organizationId,target_project_id:projectId});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error('Project labour summary eka available naha.');return row as LabourProjectSummary;}
export async function getWorkerFinancialHistory(organizationId:string,workerId:string):Promise<WorkerHistoryEntry[]>{const {data,error}=await db().rpc('get_worker_financial_history',{target_organization_id:organizationId,target_worker_id:workerId});if(error)throw error;return (data??[]) as WorkerHistoryEntry[];}

export async function recordAttendance(organizationId: string, input: AttendanceInput) {
  const value = attendanceSchema.parse(input);
  const { error } = await db().from('attendance_records').insert({
    organization_id: organizationId, worker_assignment_id: value.workerAssignmentId,
    worker_id: value.workerId, project_id: value.projectId, work_date: value.workDate,
    attendance_status: value.attendanceStatus, hours_worked: value.hoursWorked || null,
    day_fraction: value.dayFraction, notes: value.notes || null, approval_status: 'pending',
  });
  if (error) throw error;
}

export async function listAttendance(organizationId: string, projectId: string, workDate: string): Promise<AttendanceRecord[]> {
  const { data, error } = await db().from('attendance_records').select('id,worker_id,worker_assignment_id,attendance_status,hours_worked,day_fraction,approval_status,notes,worker:workers(full_name,skill_category)').eq('organization_id', organizationId).eq('project_id', projectId).eq('work_date', workDate).order('created_at');
  if (error) throw error;
  return (data ?? []) as unknown as AttendanceRecord[];
}

export async function approveAttendance(attendanceId: string) {
  const { error } = await db().rpc('approve_worker_attendance', { target_attendance_id: attendanceId });
  if (error) throw error;
}

export async function correctAttendance(attendanceId: string, input: AttendanceInput, reason: string) {
  const value = attendanceSchema.parse(input);
  if (reason.trim().length < 3) throw new Error('Correction reason eka danna.');
  const { data, error } = await db().rpc('correct_worker_attendance', {
    target_attendance_id: attendanceId, replacement_status: value.attendanceStatus,
    replacement_hours: value.hoursWorked || null, replacement_fraction: value.dayFraction,
    correction_notes: value.notes || null, correction_reason: reason.trim(),
  });
  if (error) throw error;
  return data as string;
}

export async function generateAttendanceEarnings(organizationId: string, assignmentId: string, startDate: string, endDate: string): Promise<string> {
  const { data, error } = await db().rpc('generate_attendance_earnings', {
    target_organization_id: organizationId, target_assignment_id: assignmentId,
    period_start: startDate, period_end: endDate,
  });
  if (error) throw error;
  return String(data ?? '0');
}

export async function getHalfDayFactor(organizationId: string, assignmentId: string, workDate: string): Promise<string | null> {
  const { data, error } = await db().from('worker_rate_agreements').select('half_day_factor,effective_from,effective_to').eq('organization_id', organizationId).eq('assignment_id', assignmentId).lte('effective_from', workDate).order('effective_from', { ascending: false });
  if (error) throw error;
  const agreement = data?.find(rate => !rate.effective_to || rate.effective_to >= workDate);
  return agreement ? String(agreement.half_day_factor) : null;
}

function idempotencyKey(prefix:string){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,14)}`;}
export async function listLabourAdvances(organizationId:string):Promise<LabourAdvance[]>{const {data,error}=await db().from('labour_advances').select('id,project_id,worker_id,assignment_id,amount,payment_date,payment_method,status,reference,notes').eq('organization_id',organizationId).order('payment_date',{ascending:false}).limit(100);if(error)throw error;return (data??[]) as LabourAdvance[];}
export async function listLabourSettlements(organizationId:string):Promise<LabourSettlement[]>{const {data,error}=await db().from('labour_settlements').select('id,project_id,worker_id,assignment_id,period_start,period_end,gross_earned,advance_offset,status').eq('organization_id',organizationId).order('period_end',{ascending:false}).limit(100);if(error)throw error;return (data??[]) as LabourSettlement[];}
export async function listLabourPayments(organizationId:string):Promise<LabourPayment[]>{const {data,error}=await db().from('labour_payment_transactions').select('id,worker_id,subcontractor_id,settlement_id,subcontractor_work_record_id,payment_amount,payment_date,payment_method,payment_purpose,status,reference,notes').eq('organization_id',organizationId).order('payment_date',{ascending:false}).limit(100);if(error)throw error;return (data??[]) as LabourPayment[];}
export async function recordLabourAdvance(organizationId:string,input:LabourAdvanceInput){const v=labourAdvanceSchema.parse(input);const {data,error}=await db().rpc('record_labour_advance',{target_organization_id:organizationId,target_project_id:v.projectId,target_worker_id:v.workerId,target_assignment_id:v.assignmentId||null,advance_amount:v.amount,advance_date:v.paymentDate,advance_method:v.method,advance_reference:v.reference||null,advance_notes:v.notes||null,request_key:idempotencyKey('advance')});if(error)throw error;return data as string;}
export async function createLabourSettlement(organizationId:string,input:SettlementPeriodInput){const v=settlementPeriodSchema.parse(input);const {data,error}=await db().rpc('create_labour_settlement',{target_organization_id:organizationId,target_assignment_id:v.assignmentId,period_start:v.startDate,period_end:v.endDate});if(error)throw error;return data as string;}
export async function approveLabourSettlement(id:string,advanceOffsets:{advanceId:string;amount:string}[]=[]){const {error}=await db().rpc('approve_labour_settlement',{target_settlement_id:id,advance_items:advanceOffsets});if(error)throw error;}
export async function recordLabourSettlementPayment(input:SettlementPaymentInput){const v=settlementPaymentSchema.parse(input);const {data,error}=await db().rpc('record_labour_settlement_payment',{target_settlement_id:v.settlementId,payment_amount:v.amount,payment_date:v.paymentDate,payment_method:v.method,payment_reference:v.reference||null,payment_notes:v.notes||null,request_key:idempotencyKey('labour-payment')});if(error)throw error;return data as string;}
export async function confirmLabourPayment(id:string){const {error}=await db().rpc('confirm_labour_payment',{target_payment_id:id});if(error)throw error;}
export async function confirmLabourAdvance(id:string){const {error}=await db().rpc('confirm_labour_advance',{target_advance_id:id});if(error)throw error;}
export async function reverseLabourPayment(id:string,reason:string){if(reason.trim().length<3)throw new Error('Reversal reason eka danna.');const {error}=await db().rpc('reverse_labour_payment',{target_payment_id:id,reason:reason.trim()});if(error)throw error;}
