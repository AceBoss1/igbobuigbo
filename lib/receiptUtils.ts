// lib/receiptUtils.ts
import type { IBIMember }   from '@/lib/AuthContext';
import type { ReceiptData, ReceiptParty } from '@/components/wallet/ReceiptTemplate';

// ─── Wallet transaction shape ─────────────────────────────────────────────────
export interface WalletTx {
  id:          string;
  type:        'credit' | 'debit';
  amount:      number;
  description: string;
  ref:         string;
  createdAt:   { seconds: number };
  balance:     number;
}

// ─── Platform label resolver ──────────────────────────────────────────────────
export function getPlatformLabel(description: string): string {
  const d = description.toLowerCase();
  if (d.includes('top-up') || d.includes('topup') || d.includes('paystack')) return 'IBI Top-Up (Paystack)';
  if (d.includes('commission'))   return 'IBI Commission';
  if (d.includes('bonus'))        return 'IBI Bonus';
  if (d.includes('reward'))       return 'IBI Reward';
  if (d.includes('escrow'))       return 'IBI Escrow';
  if (d.includes('registration') || d.includes('membership fee')) return 'IBI Registration';
  if (d.includes('dues'))         return 'IBI Dues';
  if (d.includes('card'))         return 'IBI Card Issuance';
  if (d.includes('admin credit')) return 'IBI Admin Credit';
  return 'IBI Platform';
}

// ─── Party resolution ─────────────────────────────────────────────────────────
export function resolveParties(
  tx:     WalletTx,
  member: IBIMember,
): { sender: ReceiptParty; recipient: ReceiptParty } {
  const desc = tx.description ?? '';

  if (tx.type === 'debit') {
    // "Transfer to Name (IBI/NUMBER)" or "Transfer to Name (IBI/NUMBER) -- note"
    const m = desc.match(/^Transfer to (.+?) \(([A-Z]{2,8}\/\d{10})\)/);
    if (m) {
      return {
        sender:    { type:'member', name:member.displayName, ibiNumber:member.ibiNumber },
        recipient: { type:'member', name:m[1], ibiNumber:m[2] },
      };
    }
    return {
      sender:    { type:'member', name:member.displayName, ibiNumber:member.ibiNumber },
      recipient: { type:'platform', name:getPlatformLabel(desc) },
    };
  }

  // credit
  const m = desc.match(/^Transfer from (.+?) \(([A-Z]{2,8}\/\d{10})\)/);
  if (m) {
    return {
      sender:    { type:'member', name:m[1], ibiNumber:m[2] },
      recipient: { type:'member', name:member.displayName, ibiNumber:member.ibiNumber },
    };
  }
  return {
    sender:    { type:'platform', name:getPlatformLabel(desc) },
    recipient: { type:'member', name:member.displayName, ibiNumber:member.ibiNumber },
  };
}

// ─── Logo pre-fetch ───────────────────────────────────────────────────────────
// Exported separately so wallet_page can call it independently from the modal.
export async function fetchLogoDataUrl(): Promise<string | null> {
  for (const path of ['/logo.webp', '/logo.png']) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror   = reject;
        r.readAsDataURL(blob);
      });
      if (dataUrl) return dataUrl;
    } catch { /* try next */ }
  }
  return null;
}

// ─── QR pre-fetch ─────────────────────────────────────────────────────────────
// Exported separately so wallet_page can call it independently.
export async function fetchQrDataUrl(referenceNo: string): Promise<string> {
  const verifyUrl = `https://igbobuigbo.org.ng/verify?ref=${encodeURIComponent(referenceNo)}`;
  const apiUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&ecc=M&data=${encodeURIComponent(verifyUrl)}`;
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error('QR API failed');
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror   = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    // 1×1 transparent PNG fallback — keeps html2canvas from crashing
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
}

// ─── Full receipt builder (used for history receipts) ─────────────────────────
export async function buildReceiptData(
  tx:          WalletTx,
  member:      IBIMember,
  showBalance: boolean,
): Promise<ReceiptData> {
  const { sender, recipient } = resolveParties(tx, member);
  const [logoDataUrl, qrDataUrl] = await Promise.all([
    fetchLogoDataUrl(),
    fetchQrDataUrl(tx.ref),
  ]);
  return {
    referenceNo:     tx.ref,
    transactionType: tx.type,
    description:     tx.description,
    dateTime:        new Date(tx.createdAt.seconds * 1000),
    amount:          tx.amount,
    currency:        'NGN',
    balanceAfter:    showBalance ? tx.balance : undefined,
    sender,
    recipient,
    logoDataUrl,
    qrDataUrl,
  };
}

// ─── PDF via html2canvas + jsPDF ──────────────────────────────────────────────
export async function downloadReceiptPdf(elementId: string, filename: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) { console.error(`[receiptUtils] #${elementId} not found in DOM`); return; }

  const [html2canvas, { jsPDF }] = await Promise.all([
    import('html2canvas').then(m => m.default),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(el, {
    scale:           2,
    useCORS:         true,
    allowTaint:      false,
    backgroundColor: '#ffffff',
    logging:         false,
    windowWidth:     el.scrollWidth,
    windowHeight:    el.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdf     = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const pageW   = pdf.internal.pageSize.getWidth();
  const pageH   = pdf.internal.pageSize.getHeight();
  const imgH    = (canvas.height * pageW) / canvas.width;

  if (imgH <= pageH) {
    pdf.addImage(imgData, 'PNG', 0, (pageH - imgH) / 2, pageW, imgH);
  } else {
    let yPos = 0, rem = imgH;
    while (rem > 0) {
      pdf.addImage(imgData, 'PNG', 0, -yPos, pageW, imgH);
      rem -= pageH; yPos += pageH;
      if (rem > 0) pdf.addPage();
    }
  }
  pdf.save(filename);
}
