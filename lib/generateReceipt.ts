// lib/generateReceipt.ts
// Generates a professional PDF receipt using jsPDF.
// Called client-side only (dynamic import).

export interface ReceiptData {
  ref:         string;
  type:        'credit' | 'debit';
  amount:      number;
  description: string;
  balance:     number;
  createdAt:   { seconds: number } | null;
  member: {
    displayName: string;
    ibiNumber:   string;
    chapter:     string;
    email:       string;
  };
}

// IBI brand colours
const RED    = [200, 16,  46 ] as const;
const GOLD   = [212, 175, 55 ] as const;
const DARK   = [26,  10,  0  ] as const;
const WHITE  = [255, 255, 255] as const;
const LGRAY  = [245, 245, 245] as const;
const MGRAY  = [150, 150, 150] as const;
const DGRAY  = [80,  80,  80 ] as const;
const GREEN  = [21,  128, 61 ] as const;

// Inline base64 SVG logo (always available, no network needed)
const LOGO_B64 = 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0M4MTAyRSIvPgogIDxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjQ2IiBmaWxsPSJub25lIiBzdHJva2U9IiNENEFGMzciIHN0cm9rZS13aWR0aD0iMiIvPgogIDxlbGxpcHNlIGN4PSI1MCIgY3k9IjM4IiByeD0iMTQiIHJ5PSIxMCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC45Ii8+CiAgPHBhdGggZD0iTTIwIDQ1IFEzNSAzMCA1MCAzOCBRNjUgMzAgODAgNDUgUTY1IDUwIDUwIDQ0IFEzNSA1MCAyMCA0NVoiIGZpbGw9IiNENEFGMzciLz4KICA8ZWxsaXBzZSBjeD0iNTAiIGN5PSI1MiIgcng9IjgiIHJ5PSIxMiIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC45Ii8+CiAgPHRleHQgeD0iNTAiIHk9Ijc4IiBmb250LWZhbWlseT0iR2VvcmdpYSxzZXJpZiIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iI0Q0QUYzNyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjIiPklCSTwvdGV4dD4KPC9zdmc+Cg==';

export async function generateReceipt(data: ReceiptData): Promise<void> {
  // Dynamic import — jsPDF is client-side only
  const { jsPDF } = await import('jspdf');

  // A5 portrait (148 × 210 mm) — compact but professional
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  const PW    = 148;  // page width
  const PH    = 210;  // page height
  const M     = 12;   // margin
  const CW    = PW - M * 2;  // content width

  const date  = data.createdAt
    ? new Date(data.createdAt.seconds * 1000)
    : new Date();
  const isCredit = data.type === 'credit';

  // ── Helper utilities ─────────────────────────────────────────────────────
  const setColor = (rgb: readonly [number,number,number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill  = (rgb: readonly [number,number,number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDraw  = (rgb: readonly [number,number,number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  // ── 1. HEADER BAND (red background) ─────────────────────────────────────
  setFill(RED);
  doc.rect(0, 0, PW, 32, 'F');

  // Logo circle
  setFill(WHITE);
  doc.circle(M + 10, 16, 8, 'F');
  setFill(RED);
  doc.circle(M + 10, 16, 7.2, 'F');
  // Gold ring
  setDraw(GOLD);
  doc.setLineWidth(0.6);
  doc.circle(M + 10, 16, 7.5, 'S');
  // "IBI" text inside circle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  setColor(GOLD);
  doc.text('IBI', M + 10, 17.2, { align: 'center' });

  // Org name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  setColor(WHITE);
  doc.text('IGBO BU IGBO', M + 22, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  setColor(GOLD);
  doc.text('UNITY & CULTURAL PRESERVATION INITIATIVE', M + 22, 18.5);

  // "OFFICIAL RECEIPT" badge — top right
  setFill(GOLD);
  doc.roundedRect(PW - M - 36, 9, 36, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  setColor(DARK);
  doc.text('OFFICIAL RECEIPT', PW - M - 18, 15.4, { align: 'center' });

  // ── 2. TRANSACTION TYPE BADGE ────────────────────────────────────────────
  const badgeColor = isCredit ? [21, 128, 61] as const : RED;
  setFill(badgeColor);
  doc.roundedRect(M, 36, CW, 11, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(WHITE);
  doc.text(
    isCredit ? '↓  CREDIT — MONEY RECEIVED' : '↑  DEBIT — MONEY SENT',
    PW / 2, 43, { align: 'center' }
  );

  // ── 3. AMOUNT (big, centred) ─────────────────────────────────────────────
  let y = 58;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  setColor(isCredit ? GREEN : RED);
  doc.text(
    `${isCredit ? '+' : '-'}₦${data.amount.toLocaleString()}`,
    PW / 2, y, { align: 'center' }
  );

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(MGRAY);
  doc.text(`Balance after: ₦${data.balance.toLocaleString()}`, PW / 2, y, { align: 'center' });

  // ── 4. THIN GOLD RULE ────────────────────────────────────────────────────
  y += 7;
  setDraw(GOLD);
  doc.setLineWidth(0.4);
  doc.line(M, y, PW - M, y);

  // ── 5. DETAILS TABLE ─────────────────────────────────────────────────────
  y += 7;
  const rows: [string, string][] = [
    ['Reference No.', data.ref],
    ['Transaction Type', isCredit ? 'Credit (Money In)' : 'Debit (Money Out)'],
    ['Description', data.description],
    ['Date & Time', date.toLocaleString('en-NG', {
      weekday:'short', day:'numeric', month:'long', year:'numeric',
      hour:'2-digit', minute:'2-digit',
    })],
    ['Member Name', data.member.displayName],
    ['IBI Number', data.member.ibiNumber || 'Pending'],
    ['Chapter', data.member.chapter || '—'],
    ['Email', data.member.email || '—'],
  ];

  const ROW_H = 10;
  rows.forEach(([label, value], i) => {
    const ry = y + i * ROW_H;
    // Alternating row bg
    if (i % 2 === 0) {
      setFill(LGRAY);
      doc.rect(M, ry - 4, CW, ROW_H, 'F');
    }
    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setColor(DGRAY);
    doc.text(label, M + 3, ry + 2);
    // Value
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setColor(DARK);
    // Truncate long values
    const maxW = CW - 55;
    const val  = doc.splitTextToSize(value, maxW)[0] ?? value;
    doc.text(val, PW - M - 3, ry + 2, { align: 'right' });
  });

  // ── 6. GOLD RULE after table ─────────────────────────────────────────────
  y += rows.length * ROW_H + 4;
  setDraw(GOLD);
  doc.setLineWidth(0.4);
  doc.line(M, y, PW - M, y);

  // ── 7. WATERMARK (diagonal) ──────────────────────────────────────────────
  doc.saveGraphicsState();
  // 15% opacity by drawing in near-white on white — jsPDF doesn't support true opacity
  // Use light grey that prints as a subtle watermark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(230, 230, 230);
  doc.text('OFFICIAL IBI RECEIPT', PW / 2, PH / 2, {
    align: 'center', angle: 45,
  });
  doc.restoreGraphicsState();

  // ── 8. QR CODE (verify URL) ──────────────────────────────────────────────
  y += 8;
  const verifyUrl = `https://igbobuigbo.org.ng/verify?id=${encodeURIComponent(data.member.ibiNumber || 'PENDING')}&ref=${encodeURIComponent(data.ref)}`;

  try {
    const QRCode = (await import('qrcode')).default;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 120, margin: 1,
      color: { dark: '#1a0a00', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
    // QR on right side
    doc.addImage(qrDataUrl, 'PNG', PW - M - 28, y, 28, 28);
  } catch {
    // QR unavailable — skip silently
  }

  // ── 9. DIGITAL SIGNATURE BLOCK ───────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  setColor(DARK);
  doc.text('Digitally Issued By:', M, y + 5);

  doc.setFont('times', 'italic');
  doc.setFontSize(13);
  setColor(RED);
  doc.text('Igbo Bu Igbo Platform', M, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  setColor(MGRAY);
  doc.text('System-generated — no physical signature required', M, y + 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  setColor(MGRAY);
  doc.text('Scan QR to verify →', PW - M - 28, y + 31, { align: 'center' });

  // ── 10. FOOTER BAND ──────────────────────────────────────────────────────
  setFill(DARK);
  doc.rect(0, PH - 16, PW, 16, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  setColor(GOLD);
  doc.text('igbobuigbo.org.ng', PW / 2, PH - 9.5, { align: 'center' });

  setColor(WHITE);
  doc.setFontSize(6);
  doc.text(
    'info@igbobuigbo.org.ng  ·  +234 (0) 806 787 1203  ·  National Secretariat, Enugu, Nigeria',
    PW / 2, PH - 5, { align: 'center' }
  );

  // ── SAVE ─────────────────────────────────────────────────────────────────
  const filename = `IBI_Receipt_${data.ref}_${date.toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}
