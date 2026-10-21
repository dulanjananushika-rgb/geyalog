export type ReceiptPdfData = {
  company: string; receiptNumber: string; projectRef: string; projectName: string; customer: string;
  amount: string; method: string; paymentDate: string; reference: string; notes: string; status: string; issuedDate: string;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function buildReceiptHtml(data: ReceiptPdfData) {
  const rows = [
    ['Project', `${data.projectRef} · ${data.projectName}`], ['Customer', data.customer],
    ['Payment date', data.paymentDate], ['Method', data.method], ['Reference', data.reference || '—'], ['Notes', data.notes || '—'],
  ].map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172B25;padding:28px;max-width:680px;margin:auto}
    .brand{font-size:21px;font-weight:700}.eyebrow{color:#1D6A4A;font-size:11px;letter-spacing:2px;font-weight:700;margin-top:44px}
    h1{font-size:19px;margin:8px 0;color:#172B25}.ref{font-size:12px;color:#6C7A74}.amount{font-size:29px;font-weight:700;margin:30px 0 5px}
    .state{font-size:11px;color:#1D6A4A;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:25px}
    table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;vertical-align:top;border-top:1px solid #E4EAE4;padding:12px 4px}th{color:#6C7A74;width:34%;font-weight:500}
    .foot{border-top:1px solid #E4EAE4;margin-top:28px;padding-top:13px;color:#6C7A74;font-size:10px;line-height:1.6}
  </style></head><body><div class="brand">${escapeHtml(data.company)}</div><div class="eyebrow">PAYMENT RECEIPT</div><h1>${escapeHtml(data.receiptNumber)}</h1><div class="ref">Issued ${escapeHtml(data.issuedDate)}</div><div class="amount">${escapeHtml(data.amount)}</div><div class="state">${escapeHtml(data.status)}</div><table>${rows}</table><div class="foot">This document acknowledges a payment recorded by the contractor. It is not an invoice or a payment demand. Cheque clearing or bank transfer verification is not asserted unless separately confirmed by the company's own process.</div></body></html>`;
}

export type PurchaseOrderPdfData = {
  company: string;
  poReference: string;
  supplier: string;
  orderDate: string;
  expectedDelivery: string;
  status: string;
  notes: string;
  lines: { name: string; quantity: string; unitPrice?: string; subtotal?: string }[];
};

export function buildPurchaseOrderHtml(data: PurchaseOrderPdfData) {
  const lineRows = data.lines.map(line => `
    <tr>
      <td style="padding:10px 4px;border-top:1px solid #E4EAE4">${escapeHtml(line.name)}</td>
      <td style="padding:10px 4px;border-top:1px solid #E4EAE4;text-align:right">${escapeHtml(line.quantity)}</td>
      ${line.unitPrice ? `<td style="padding:10px 4px;border-top:1px solid #E4EAE4;text-align:right">${escapeHtml(line.unitPrice)}</td>` : ''}
      ${line.subtotal ? `<td style="padding:10px 4px;border-top:1px solid #E4EAE4;text-align:right">${escapeHtml(line.subtotal)}</td>` : ''}
    </tr>
  `).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172B25;padding:28px;max-width:680px;margin:auto}
    .brand{font-size:22px;font-weight:700}.eyebrow{color:#1D6A4A;font-size:11px;letter-spacing:2px;font-weight:700;margin-top:35px}
    h1{font-size:20px;margin:6px 0;color:#172B25}.meta{font-size:12px;color:#6C7A74;margin-bottom:20px}
    table{border-collapse:collapse;width:100%;font-size:13px;margin-top:15px}th{text-align:left;color:#6C7A74;padding:8px 4px;font-weight:600}
    .foot{border-top:1px solid #E4EAE4;margin-top:35px;padding-top:14px;color:#6C7A74;font-size:10px;line-height:1.5}
  </style></head><body>
    <div class="brand">${escapeHtml(data.company)}</div>
    <div class="eyebrow">PURCHASE ORDER</div>
    <h1>${escapeHtml(data.poReference)}</h1>
    <div class="meta">Supplier: <strong>${escapeHtml(data.supplier)}</strong> · Order Date: ${escapeHtml(data.orderDate)} ${data.expectedDelivery ? `· Expected Delivery: ${escapeHtml(data.expectedDelivery)}` : ''}</div>
    ${data.notes ? `<p style="font-size:13px;color:#555;background:#F4F6F4;padding:10px">Notes: ${escapeHtml(data.notes)}</p>` : ''}
    <table>
      <thead>
        <tr><th>Material / Item</th><th style="text-align:right">Quantity</th>${data.lines[0]?.unitPrice ? '<th style="text-align:right">Unit Price</th><th style="text-align:right">Subtotal</th>' : ''}</tr>
      </thead>
      <tbody>
        ${lineRows}
      </tbody>
    </table>
    <div class="foot">This purchase order is an official material request issued via GeyaLog. Please supply goods matching the requested specifications.</div>
  </body></html>`;
}
