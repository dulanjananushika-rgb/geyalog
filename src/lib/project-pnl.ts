import { decimalToMinorUnits } from './finance-money.ts';
import { supabase } from './supabase';
import { getProjectFinancialSummary } from './customer-payments';
import { getLabourProjectSummary } from './workforce';
import { calculateProjectPnl, type ProjectPnlSummary } from './project-pnl-calc.ts';

export { calculateProjectPnl, type ProjectPnlSummary };

export async function fetchProjectPnlSummary(
  organizationId: string,
  projectId: string,
): Promise<ProjectPnlSummary> {
  const [financialSummary, labourSummary, poResult] = await Promise.all([
    getProjectFinancialSummary(organizationId, projectId).catch(() => null),
    getLabourProjectSummary(organizationId, projectId).catch(() => null),
    supabase
      ? supabase
          .from('purchase_orders')
          .select('id, status, purchase_order_lines(ordered_quantity, unit_cost)')
          .eq('organization_id', organizationId)
          .eq('project_id', projectId)
          .neq('status', 'cancelled')
      : Promise.resolve({ data: [] }),
  ]);

  let materialsMinor = 0n;
  const poData = poResult.data as { purchase_order_lines: { ordered_quantity: string; unit_cost: string }[] }[] | null;
  if (poData) {
    for (const po of poData) {
      for (const line of po.purchase_order_lines || []) {
        try {
          const [qWhole, qFrac = ''] = (line.ordered_quantity || '0').split('.');
          const qInt = BigInt(qWhole) * 10000n + BigInt((qFrac || '').padEnd(4, '0'));
          const cMinor = decimalToMinorUnits(line.unit_cost);
          materialsMinor += (qInt * cMinor) / 10000n;
        } catch {
          // ignore precision parsing issues on edge values
        }
      }
    }
  }

  const materialsCostStr = (Number(materialsMinor) / 100).toFixed(2);
  const contractVal = financialSummary?.revised_contract_value ?? financialSummary?.original_contract_value ?? '0.00';
  const confirmedRec = financialSummary?.confirmed_receipts ?? '0.00';
  const outDue = financialSummary?.outstanding_due ?? '0.00';
  const labourCostStr = labourSummary?.earned_labour_cost ?? '0.00';

  return calculateProjectPnl({
    contractValue: contractVal,
    confirmedReceipts: confirmedRec,
    outstandingDue: outDue,
    materialsCost: materialsCostStr,
    labourCost: labourCostStr,
  });
}
