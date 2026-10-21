import { decimalToMinorUnits, minorUnitsToLkr } from './finance-money.ts';

export type ProjectPnlSummary = {
  contractValueMinor: bigint;
  contractValueDisplay: string;
  revenueReceivedMinor: bigint;
  revenueReceivedDisplay: string;
  revenueOutstandingMinor: bigint;
  revenueOutstandingDisplay: string;
  materialsCostMinor: bigint;
  materialsCostDisplay: string;
  labourCostMinor: bigint;
  labourCostDisplay: string;
  totalCostMinor: bigint;
  totalCostDisplay: string;
  projectedProfitMinor: bigint;
  projectedProfitDisplay: string;
  profitMarginPercent: number;
  cashFlowMinor: bigint;
  cashFlowDisplay: string;
  isProfitable: boolean;
};

export function calculateProjectPnl(params: {
  contractValue: string | null | undefined;
  confirmedReceipts: string | null | undefined;
  outstandingDue: string | null | undefined;
  materialsCost: string | null | undefined;
  labourCost: string | null | undefined;
}): ProjectPnlSummary {
  const contractValueMinor = decimalToMinorUnits(params.contractValue);
  const revenueReceivedMinor = decimalToMinorUnits(params.confirmedReceipts);
  const revenueOutstandingMinor = decimalToMinorUnits(params.outstandingDue);
  const materialsCostMinor = decimalToMinorUnits(params.materialsCost);
  const labourCostMinor = decimalToMinorUnits(params.labourCost);

  const totalCostMinor = materialsCostMinor + labourCostMinor;
  const projectedProfitMinor = contractValueMinor - totalCostMinor;
  const cashFlowMinor = revenueReceivedMinor - totalCostMinor;

  const profitMarginPercent =
    contractValueMinor > 0n
      ? Number((projectedProfitMinor * 10000n) / contractValueMinor) / 100
      : 0;

  return {
    contractValueMinor,
    contractValueDisplay: minorUnitsToLkr(contractValueMinor),
    revenueReceivedMinor,
    revenueReceivedDisplay: minorUnitsToLkr(revenueReceivedMinor),
    revenueOutstandingMinor,
    revenueOutstandingDisplay: minorUnitsToLkr(revenueOutstandingMinor),
    materialsCostMinor,
    materialsCostDisplay: minorUnitsToLkr(materialsCostMinor),
    labourCostMinor,
    labourCostDisplay: minorUnitsToLkr(labourCostMinor),
    totalCostMinor,
    totalCostDisplay: minorUnitsToLkr(totalCostMinor),
    projectedProfitMinor,
    projectedProfitDisplay: minorUnitsToLkr(projectedProfitMinor),
    profitMarginPercent,
    cashFlowMinor,
    cashFlowDisplay: minorUnitsToLkr(cashFlowMinor),
    isProfitable: projectedProfitMinor >= 0n,
  };
}
