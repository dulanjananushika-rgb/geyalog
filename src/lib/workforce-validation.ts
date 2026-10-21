import { z } from 'zod';

const moneyRate = z.string().trim().regex(/^\d{1,14}(\.\d{1,4})?$/, 'Rate eka valid amount ekak wenna one.').refine((value) => Number(value) > 0, 'Rate eka 0 ta wada wadi wenna one.');

export const workerSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama akuru 2k wath danna.').max(160),
  phone: z.string().trim().max(32).optional().or(z.literal('')),
  skillCategory: z.string().trim().min(2, 'Skill category eka danna.').max(80),
  engagementType: z.enum(['employee', 'daily_worker', 'subcontractor_individual', 'other']),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const workerAssignmentSchema = z.object({
  workerId: z.string().uuid(),
  projectId: z.string().uuid(),
  workRole: z.string().trim().min(2).max(120),
  startDate: z.string().date(),
  earningMethod: z.enum(['daily_rate', 'weekly_rate', 'task_quantity']),
  paymentSchedule: z.enum(['daily', 'weekly', 'milestone', 'task_completion', 'custom']),
  rate: moneyRate,
  weeklyWorkDays: z.string().regex(/^[1-7](?:\.\d)?$/).default('6'),
  unitName: z.string().trim().max(40).optional().or(z.literal('')),
  effectiveFrom: z.string().date(),
  halfDayFactor: z.string().regex(/^(0(\.\d{1,5})?|1(\.0{1,5})?)$/),
}).superRefine((value, ctx) => {
  if (value.earningMethod === 'task_quantity' && !value.unitName?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['unitName'], message: 'Task work walata unit eka danna.' });
  }
});

export const attendanceSchema = z.object({
  workerAssignmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  projectId: z.string().uuid(),
  workDate: z.string().date(),
  attendanceStatus: z.enum(['present', 'half_day', 'absent', 'approved_leave', 'other']),
  hoursWorked: z.string().regex(/^(?:[0-9]|1[0-9]|2[0-4])(?:\.\d{1,2})?$/).optional().or(z.literal('')),
  dayFraction: z.string().regex(/^(?:0(?:\.\d{1,5})?|1(?:\.0{1,5})?)$/),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (['absent', 'approved_leave'].includes(value.attendanceStatus) && value.dayFraction !== '0') {
    ctx.addIssue({ code: 'custom', path: ['dayFraction'], message: 'Absent/leave nam work fraction eka 0 wenna one.' });
  }
});

export const labourAdvanceSchema = z.object({
  projectId:z.string().uuid(),workerId:z.string().uuid(),assignmentId:z.string().uuid().optional().or(z.literal('')),
  amount:z.string().trim().regex(/^\d{1,14}(\.\d{1,2})?$/,'Amount eka decimals 2 ta yatin danna.').refine(v=>Number(v)>0,'Amount eka 0 ta wada wadi wenna one.'),
  paymentDate:z.string().date(),method:z.enum(['cash','bank_transfer','cheque','other']),reference:z.string().trim().max(160).optional().or(z.literal('')),notes:z.string().trim().max(1000).optional().or(z.literal('')),
});
export const settlementPeriodSchema=z.object({assignmentId:z.string().uuid(),startDate:z.string().date(),endDate:z.string().date()}).refine(v=>v.endDate>=v.startDate,{path:['endDate'],message:'End date eka start date ekata passe wenna one.'});
export const settlementPaymentSchema=z.object({settlementId:z.string().uuid(),amount:z.string().trim().regex(/^\d{1,14}(\.\d{1,2})?$/).refine(v=>Number(v)>0),paymentDate:z.string().date(),method:z.enum(['cash','bank_transfer','cheque','other']),reference:z.string().trim().max(160).optional().or(z.literal('')),notes:z.string().trim().max(1000).optional().or(z.literal(''))});
export const workerRateSchema=z.object({assignmentId:z.string().uuid(),earningMethod:z.enum(['daily_rate','weekly_rate','task_quantity']),rate:moneyRate,unitName:z.string().trim().max(40).optional().or(z.literal('')),halfDayFactor:z.string().regex(/^(0(\.\d{1,5})?|1(\.0{1,5})?)$/),weeklyWorkDays:z.string().regex(/^[1-7](?:\.\d)?$/).default('6'),effectiveFrom:z.string().date(),notes:z.string().trim().max(1000).optional().or(z.literal(''))}).superRefine((v,ctx)=>{if(v.earningMethod==='task_quantity'&&!v.unitName?.trim())ctx.addIssue({code:'custom',path:['unitName'],message:'Quantity rate ekata unit eka required.'});});
const taskQuantity=z.string().trim().regex(/^\d{1,14}(\.\d{1,4})?$/).refine(v=>Number(v)>0,'Quantity eka 0 ta wada wadi wenna one.');
export const labourTaskSchema=z.object({projectId:z.string().uuid(),assignmentId:z.string().uuid(),taskName:z.string().trim().min(2).max(180),paymentBasis:z.enum(['unit_rate','fixed_task']),unitName:z.string().trim().min(1).max(40),unitRate:z.string().trim().regex(/^\d{1,14}(\.\d{1,4})?$/).optional().or(z.literal('')),fixedAmount:z.string().trim().regex(/^\d{1,14}(\.\d{1,2})?$/).optional().or(z.literal('')),estimatedQuantity:z.string().trim().regex(/^\d{1,14}(\.\d{1,4})?$/).optional().or(z.literal(''))}).superRefine((v,ctx)=>{if(v.paymentBasis==='unit_rate'&&(!v.unitRate||Number(v.unitRate)<=0))ctx.addIssue({code:'custom',path:['unitRate'],message:'Per unit rate eka danna.'});if(v.paymentBasis==='fixed_task'&&(!v.fixedAmount||Number(v.fixedAmount)<=0))ctx.addIssue({code:'custom',path:['fixedAmount'],message:'Agreed fixed amount eka danna.'});if(v.paymentBasis==='fixed_task'&&(!v.estimatedQuantity||Number(v.estimatedQuantity)<=0))ctx.addIssue({code:'custom',path:['estimatedQuantity'],message:'Staged approval walata agreed quantity required.'});});
export const labourTaskProgressSchema=z.object({taskId:z.string().uuid(),quantity:taskQuantity,progressDate:z.string().date(),notes:z.string().trim().max(1000).optional().or(z.literal(''))});
export const subcontractorSchema=z.object({businessName:z.string().trim().min(2).max(180),contactName:z.string().trim().max(160).optional().or(z.literal('')),phone:z.string().trim().max(32).optional().or(z.literal('')),email:z.string().trim().email().max(320).optional().or(z.literal('')),address:z.string().trim().max(500).optional().or(z.literal(''))});
export const subcontractorAgreementSchema=z.object({projectId:z.string().uuid(),subcontractorId:z.string().uuid(),description:z.string().trim().min(2).max(2000),paymentBasis:z.enum(['unit_rate','fixed_task','milestone']),unitName:z.string().trim().max(40).optional().or(z.literal('')),rate:z.string().trim().regex(/^\d{1,14}(\.\d{1,4})?$/).optional().or(z.literal('')),agreedAmount:z.string().trim().regex(/^\d{1,14}(\.\d{1,2})?$/).optional().or(z.literal('')),startDate:z.string().date().optional().or(z.literal('')),endDate:z.string().date().optional().or(z.literal(''))}).superRefine((v,ctx)=>{if(v.paymentBasis==='unit_rate'&&(!v.unitName||!v.rate||Number(v.rate)<=0))ctx.addIssue({code:'custom',path:['rate'],message:'Unit saha valid rate eka danna.'});if(v.paymentBasis!=='unit_rate'&&(!v.agreedAmount||Number(v.agreedAmount)<=0))ctx.addIssue({code:'custom',path:['agreedAmount'],message:'Agreed amount eka danna.'});if(v.endDate&&v.startDate&&v.endDate<v.startDate)ctx.addIssue({code:'custom',path:['endDate'],message:'End date eka start date ekata passe wenna one.'});});
export const subcontractorWorkSchema=z.object({agreementId:z.string().uuid(),workDate:z.string().date(),quantity:z.string().trim().regex(/^\d{1,14}(\.\d{1,4})?$/).optional().or(z.literal('')),requestedAmount:z.string().trim().regex(/^\d{1,14}(\.\d{1,2})?$/).optional().or(z.literal(''))});
export const subcontractorPaymentSchema=z.object({workRecordId:z.string().uuid(),amount:z.string().trim().regex(/^\d{1,14}(\.\d{1,2})?$/).refine(v=>Number(v)>0),paymentDate:z.string().date(),method:z.enum(['cash','bank_transfer','cheque','other']),reference:z.string().trim().max(160).optional().or(z.literal('')),notes:z.string().trim().max(1000).optional().or(z.literal(''))});

export type WorkerInput = z.infer<typeof workerSchema>;
export type WorkerAssignmentInput = z.infer<typeof workerAssignmentSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type LabourAdvanceInput=z.infer<typeof labourAdvanceSchema>;
export type SettlementPeriodInput=z.infer<typeof settlementPeriodSchema>;
export type SettlementPaymentInput=z.infer<typeof settlementPaymentSchema>;
export type WorkerRateInput=z.infer<typeof workerRateSchema>;
export type LabourTaskInput=z.infer<typeof labourTaskSchema>;
export type LabourTaskProgressInput=z.infer<typeof labourTaskProgressSchema>;
export type SubcontractorInput=z.infer<typeof subcontractorSchema>;
export type SubcontractorAgreementInput=z.infer<typeof subcontractorAgreementSchema>;
export type SubcontractorWorkInput=z.infer<typeof subcontractorWorkSchema>;
export type SubcontractorPaymentInput=z.infer<typeof subcontractorPaymentSchema>;
