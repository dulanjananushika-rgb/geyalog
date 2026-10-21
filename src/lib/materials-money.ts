import { decimalToMinorUnits } from './finance-money';

const Q = 10_000n;
const round = (n: bigint, d: bigint) => { if (d <= 0n) throw new Error('Quantity divisor must be positive.'); return (n + d / 2n) / d; };

export function parseQuantity(value: string): bigint {
  const v=value.trim();
  if(!/^\d{1,10}(\.\d{1,4})?$/.test(v)) throw new Error('Enter a non-negative quantity with up to 4 decimal places.');
  const [whole,frac='']=v.split('.'); return BigInt(whole)*Q+BigInt(frac.padEnd(4,'0'));
}
export function formatQuantity(value: bigint): string {
  const neg=value<0n, abs=neg?-value:value, whole=abs/Q, fraction=(abs%Q).toString().padStart(4,'0').replace(/0+$/,'');
  return `${neg?'-':''}${whole}${fraction?`.${fraction}`:''}`;
}
export function calculateMaterialLineValue(unitPrice:string,quantity:string,discount='0.00',tax='0.00'):string {
  const price=decimalToMinorUnits(unitPrice),qty=parseQuantity(quantity),discountCents=decimalToMinorUnits(discount),taxCents=decimalToMinorUnits(tax);
  const gross=round(price*qty,Q); if(discountCents>gross) throw new Error('Line discount cannot exceed the line value.');
  const total=gross-discountCents+taxCents; return `${total/100n}.${(total%100n).toString().padStart(2,'0')}`;
}
export function calculateSupplierInvoiceTotal(subtotal:string,discount='0.00',tax='0.00',delivery='0.00'):string {
  const gross=decimalToMinorUnits(subtotal),off=decimalToMinorUnits(discount),taxCents=decimalToMinorUnits(tax),deliveryCents=decimalToMinorUnits(delivery);
  if(off>gross) throw new Error('Invoice discount cannot exceed subtotal.');
  const total=gross-off+taxCents+deliveryCents; return `${total/100n}.${(total%100n).toString().padStart(2,'0')}`;
}
export type InventoryBalanceInput={materialId:string;unit:string;fundingSource:'contractor'|'customer';quantityDelta:string}[];
export function calculateInventoryBalances(movements:InventoryBalanceInput){
  const balances=new Map<string,bigint>();
  for(const row of movements){const key=`${row.materialId}\u0000${row.unit}\u0000${row.fundingSource}`;balances.set(key,(balances.get(key)??0n)+parseSignedQuantity(row.quantityDelta));}
  return [...balances.entries()].map(([key,value])=>{const [materialId,unit,fundingSource]=key.split('\u0000');return{materialId,unit,fundingSource,quantity:formatQuantity(value)};});
}
function parseSignedQuantity(value:string){const neg=value.startsWith('-');const q=parseQuantity(neg?value.slice(1):value);return neg?-q:q;}
