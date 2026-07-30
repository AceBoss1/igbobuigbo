// components/wallet/StatementReport.tsx
'use client';
import { useState, useMemo } from 'react';
import type { IBIMember }    from '@/lib/AuthContext';
import type { WalletTx }     from '@/lib/receiptUtils';
import PinConfirmModal       from '@/components/PinConfirmModal';
import { scaleForDisplay, type PinMode } from '@/lib/pinSessionClient';
import { useAuth } from '@/lib/AuthContext';

interface Props { transactions: WalletTx[]; member: IBIMember; }

async function generateAuthKey(uid: string, ibiNumber: string, from: string, to: string): Promise<string> {
  const enc    = new TextEncoder();
  const keyMat = await crypto.subtle.importKey('raw', enc.encode(uid), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const sig    = await crypto.subtle.sign('HMAC', keyMat, enc.encode(`${ibiNumber}:${from}:${to}`));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,24).toUpperCase();
}

function buildStmtId(ibiNumber: string, from: string, to: string): string {
  return `IBI-STMT-${ibiNumber.replace('/','-')}_${from.replaceAll('-','')}-${to.replaceAll('-','')}`;
}

async function generateStatementPdf(
  txs: WalletTx[], member: IBIMember, from: string, to: string, authKey: string, stmtId: string,
) {
  const { jsPDF, GState } = await import('jspdf');

  // ── Logo ─────────────────────────────────────────────────────────────────
  let logoDataUrl: string | null = null;
  for (const path of ['/logo.webp', '/logo.png']) {
    try {
      const res = await fetch(path); if (!res.ok) continue;
      const blob = await res.blob();
      logoDataUrl = await new Promise<string>((ok, err) => {
        const r = new FileReader(); r.onloadend = () => ok(r.result as string); r.onerror = err; r.readAsDataURL(blob);
      });
      break;
    } catch {}
  }

  // ── QR ───────────────────────────────────────────────────────────────────
  const verifyUrl = `https://igbobuigbo.org.ng/verify?ref=${encodeURIComponent(stmtId)}&key=${authKey}`;
  const qrApiUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&ecc=M&data=${encodeURIComponent(verifyUrl)}`;
  let qrDataUrl: string | null = null;
  try {
    const res = await fetch(qrApiUrl); if (res.ok) {
      const blob = await res.blob();
      qrDataUrl  = await new Promise<string>((ok, err) => {
        const r = new FileReader(); r.onloadend = () => ok(r.result as string); r.onerror = err; r.readAsDataURL(blob);
      });
    }
  } catch {}

  // ── Constants ─────────────────────────────────────────────────────────────
  const pdf      = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W        = pdf.internal.pageSize.getWidth();   // 210mm
  const H        = pdf.internal.pageSize.getHeight();  // 297mm
  const M        = 14;
  const RH       = 7.5;
  const HEADER_H = 34;
  const FOOTER_H = 10;
  const fmtN = (n: number) => 'NGN ' + n.toLocaleString('en-NG', { minimumFractionDigits:2, maximumFractionDigits:2 });

  // ── HEADER ───────────────────────────────────────────────────────────────
  pdf.setFillColor(139, 26, 26);
  pdf.rect(0, 0, W, HEADER_H, 'F');

  const LOGO_SIZE = HEADER_H - 6;
  if (logoDataUrl) {
    try { pdf.addImage(logoDataUrl, logoDataUrl.startsWith('data:image/webp')?'WEBP':'PNG', M, 3, LOGO_SIZE, LOGO_SIZE); } catch {}
  }
  const NAME_X = M + (logoDataUrl ? LOGO_SIZE + 3 : 0);
  pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold');   pdf.setFontSize(13); pdf.text('IGBO BU IGBO', NAME_X, 12);
  pdf.setFont('helvetica','normal'); pdf.setFontSize(7);
  pdf.text('UNITY & CULTURAL PRESERVATION', NAME_X, 18);
  pdf.text('INITIATIVE', NAME_X, 22);

  const QR_W = 28; const QR_X = W - M - QR_W;
  if (qrDataUrl) { try { pdf.addImage(qrDataUrl, 'PNG', QR_X, 3, QR_W, QR_W); } catch {} }

  const TXT_X = QR_X - 3; const TY = 5; const TL = 4.8;
  pdf.setTextColor(212,175,55); pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
  pdf.text('Scan QR code to verify this', TXT_X, TY, { align:'right' });
  pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold'); pdf.setFontSize(13);
  pdf.text('WALLET STATEMENT', TXT_X, TY+TL+2, { align:'right' });
  pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
  pdf.text('Digitally Issued by:', TXT_X, TY+TL*3, { align:'right' });
  pdf.setTextColor(212,175,55); pdf.setFont('helvetica','bold');
  pdf.text('igbobuigbo.org.ng', TXT_X, TY+TL*4, { align:'right' });
  pdf.setTextColor(255,255,255); pdf.setFont('helvetica','normal'); pdf.setFontSize(5.8);
  pdf.text('System-generated -- no physical', TXT_X, TY+TL*5,   { align:'right' });
  pdf.text('signature required',              TXT_X, TY+TL*5.9, { align:'right' });

  // ── TOP GOLD RULE ─────────────────────────────────────────────────────────
  const DIV1_Y = HEADER_H + 1;
  pdf.setDrawColor(212,175,55); pdf.setLineWidth(0.7);
  pdf.line(M, DIV1_Y, W-M, DIV1_Y);

  // ── MEMBER BLOCK ─────────────────────────────────────────────────────────
  // LEFT:  Member name · contact · address lines
  // RIGHT: IBI No → gap → Period → Generated → Statement ID → Auth Key
  // All right-column items are right-aligned from W-M.

  const PAD_TOP = 5;
  const LEAD_H  = 5;    // heading line height
  const LEAD_N  = 4.5;  // normal line height
  const LEAD_S  = 4;    // small bold line height

  pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5);
  const addrFull  = [member.address, member.state].filter(Boolean).join(', ');
  const LEFT_W    = W * 0.46;
  const addrLines: string[] = addrFull ? pdf.splitTextToSize(addrFull, LEFT_W) : [];
  const contact   = [member.email, member.phone].filter(Boolean).join('  |  ');

  pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
  const genDate    = new Date().toLocaleString('en-NG', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false });
  const RIGHT_W    = W / 2;
  const stmtLines: string[] = pdf.splitTextToSize(`Statement ID: ${stmtId}`, RIGHT_W - M);
  const authLines: string[] = pdf.splitTextToSize(`Auth Key [SECURED]: ${authKey}`, RIGHT_W - M);

  // Block height = max(left column, right column) + padding
  const leftH  = LEAD_H + (contact ? LEAD_N : 0) + addrLines.length * LEAD_N;
  const rightH = LEAD_H + 5 + LEAD_N + LEAD_N + stmtLines.length * LEAD_S + authLines.length * LEAD_S;
  const blockH = PAD_TOP + Math.max(leftH, rightH) + 4;

  // Light background
  pdf.setFillColor(250, 250, 250);
  pdf.rect(0, DIV1_Y + 1, W, blockH, 'F');

  let yL = DIV1_Y + 1 + PAD_TOP;
  let yR = DIV1_Y + 1 + PAD_TOP;

  // LEFT: name
  pdf.setTextColor(31,41,55); pdf.setFont('helvetica','bold'); pdf.setFontSize(8.5);
  pdf.text(`Member: ${member.displayName}`, M, yL); yL += LEAD_H;

  // LEFT: contact
  pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5);
  if (contact) { pdf.setTextColor(107,114,128); pdf.text(contact, M, yL); yL += LEAD_N; }

  // LEFT: address (multi-line)
  addrLines.forEach((line: string) => { pdf.setTextColor(107,114,128); pdf.text(line, M, yL); yL += LEAD_N; });

  // RIGHT: IBI No (bold)
  pdf.setTextColor(31,41,55); pdf.setFont('helvetica','bold'); pdf.setFontSize(8.5);
  pdf.text(`IBI No: ${member.ibiNumber}`, W-M, yR, { align:'right' }); yR += LEAD_H + 5;

  // RIGHT: Period + Generated (normal, muted)
  pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5); pdf.setTextColor(107,114,128);
  pdf.text(`Period: ${new Date(from).toDateString()}  to  ${new Date(to).toDateString()}`, W-M, yR, { align:'right' }); yR += LEAD_N;
  pdf.text(`Generated: ${genDate}`, W-M, yR, { align:'right' }); yR += LEAD_N;

  // RIGHT: Statement ID + Auth Key (bold red)
  pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(139,26,26);
  stmtLines.forEach((l: string) => { pdf.text(l, W-M, yR, { align:'right' }); yR += LEAD_S; });
  authLines.forEach((l: string) => { pdf.text(l, W-M, yR, { align:'right' }); yR += LEAD_S; });

  // ── BOTTOM GOLD RULE ──────────────────────────────────────────────────────
  const DIV2_Y = DIV1_Y + 1 + blockH;
  pdf.setDrawColor(212,175,55); pdf.setLineWidth(0.7);
  pdf.line(M, DIV2_Y, W-M, DIV2_Y);

  let y = DIV2_Y + 6;

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  const totalIn  = txs.filter(t=>t.type==='credit').reduce((s,t)=>s+t.amount,0);
  const totalOut = txs.filter(t=>t.type==='debit').reduce((s,t)=>s+t.amount,0);
  const net      = totalIn - totalOut;

  pdf.setFillColor(250,250,250); pdf.rect(M, y, W-2*M, 11, 'F');
  pdf.setFont('helvetica','bold'); pdf.setFontSize(8);
  pdf.setTextColor(22,101,52);  pdf.text(`Total In:  ${fmtN(totalIn)}`,  M+4,    y+7);
  pdf.setTextColor(153,27,27);  pdf.text(`Total Out: ${fmtN(totalOut)}`, W/3+4,  y+7);
  pdf.setTextColor(net>=0?22:153, net>=0?101:27, net>=0?52:27);
  pdf.text(`Net: ${fmtN(Math.abs(net))}  (${txs.length} transactions)`, W-M-4, y+7, { align:'right' });
  y += 15;

  // ── TABLE ─────────────────────────────────────────────────────────────────
  const COLS = [30,70,28,20,28];
  const HDRS = ['Date & Time','Description','Reference','Type','Amount'];
  pdf.setFillColor(139,26,26); pdf.rect(M, y, W-2*M, RH, 'F');
  pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold'); pdf.setFontSize(7);
  let x = M;
  HDRS.forEach((h,i) => { const px=i===4?x+COLS[i]-2:x+2; pdf.text(h,px,y+RH/2+1.5,{align:i===4?'right':'left'}); x+=COLS[i]; });
  y += RH;

  pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
  txs.forEach((tx, idx) => {
    if (y + RH > H - FOOTER_H - 4) { pdf.addPage(); y = M; }
    const isC = tx.type==='credit';
    pdf.setFillColor(idx%2===0?255:249, idx%2===0?255:249, 249);
    pdf.rect(M, y, W-2*M, RH, 'F');
    const date  = new Date(tx.createdAt.seconds*1000).toLocaleString('en-NG',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
    const desc  = tx.description.length>48 ? tx.description.slice(0,48)+'...' : tx.description;
    const ref   = tx.ref.length>18 ? '...'+tx.ref.slice(-15) : tx.ref;
    const vals  = [date, desc, ref, isC?'Credit':'Debit', fmtN(tx.amount)];
    x = M;
    vals.forEach((v,i) => {
      pdf.setTextColor(i===3?(isC?22:153):55, i===3?(isC?101:27):65, i===3?(isC?52:27):81);
      const px=i===4?x+COLS[i]-2:x+2; pdf.text(v,px,y+RH/2+1.5,{align:i===4?'right':'left'}); x+=COLS[i];
    });
    y += RH;
  });

  // ── PER-PAGE: watermark then footer ───────────────────────────────────────
  //
  // WATERMARK POSITION: H / 2  (= 148.5mm — matches the HTML preview's top:50%)
  //
  // Why H/2 instead of body-centre (160.5mm):
  //   The HTML positions the watermark at top:50% of the FULL page height.
  //   At 46pt bold and 45°, the text diagonal half-span ≈ 96mm, so the
  //   top edge of the text lands at 148.5 - 96 ≈ 52mm — i.e. ~18mm below
  //   the header band — making it appear to "start from after the header",
  //   exactly as in the HTML preview.
  //
  // The footer red band is drawn AFTER the watermark so it always sits on top.
  //
  const WM_Y    = H / 2;          // 148.5mm — same as HTML top:50%
  const pages   = pdf.getNumberOfPages();

  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);

   // 1. Watermark
// Positioned in the body area only (below header/member section)
// and centered diagonally across the statement content.

try {
  const BODY_TOP = DIV2_Y + 15;      // start after member block + summary spacing
  const BODY_BOTTOM = H - FOOTER_H;

  const WM_CENTER_Y =
    BODY_TOP + ((BODY_BOTTOM - BODY_TOP) / 2);

  pdf.saveGraphicsState();

  pdf.setGState(
    // jsPDF's GState type only declares `opacity`, but its runtime
    // constructor accepts the full PDF ExtGState dictionary (including
    // fill-opacity, stroke-opacity, etc.) — an incomplete upstream type,
    // not an invalid option. Cast past it rather than dropping
    // fill-opacity, which is part of the canonical watermark spec.
    new GState({
      opacity: 0.045,
      'fill-opacity': 0.045,
    } as any)
  );

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(60);
  pdf.setTextColor(139, 26, 26);

  pdf.text(
    'IBI OFFICIAL',
    W / 2,
    WM_CENTER_Y - 10,
    {
      angle: 45,
      align: 'center',
    }
  );

  pdf.setFontSize(48);

  pdf.text(
    'WALLET STATEMENT',
    W / 2,
    WM_CENTER_Y + 70,
    {
      angle: 45,
      align: 'center',
    }
  );

  pdf.restoreGraphicsState();
} catch {}

    // 2. Footer — drawn LAST, always on top of watermark
    pdf.setFillColor(139,26,26);
    pdf.rect(0, H-FOOTER_H, W, FOOTER_H, 'F');
    pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5);
    pdf.setTextColor(212,175,55);
    pdf.text('info@igbobuigbo.org.ng   |   +234 (0) 806 787 1203   |   National Secretariat, Enugu, Nigeria', W/2, H-3.5, { align:'center' });
    pdf.setTextColor(255,255,255);
    pdf.text(`Page ${p} / ${pages}`, W-M, H-3.5, { align:'right' });
  }

  pdf.save(`${stmtId}.pdf`);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function StatementReport({ transactions, member }: Props) {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0,10);
  const ago30 = new Date(Date.now()-30*86_400_000).toISOString().slice(0,10);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(ago30);
  const [to,   setTo]   = useState(today);
  const [busy, setBusy] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);

  const filtered = useMemo(() => {
    const f = new Date(from).setHours(0,0,0,0);
    const t = new Date(to).setHours(23,59,59,999);
    return transactions
      .filter(tx => { const ms=tx.createdAt.seconds*1000; return ms>=f&&ms<=t; })
      .sort((a,b) => b.createdAt.seconds - a.createdAt.seconds);
  }, [transactions, from, to]);

  const totalIn  = filtered.filter(t=>t.type==='credit').reduce((s,t)=>s+t.amount,0);
  const totalOut = filtered.filter(t=>t.type==='debit').reduce((s,t)=>s+t.amount,0);

  // Statement generation requires a FRESH PIN every time, same as any other
  // transaction — this only exists client-side because it's not itself a
  // money-moving API call (it's a read-only PDF built from data already on
  // the page), so there's no server route to enforce it. /api/wallet/pin/verify
  // is a plain PIN-check endpoint (rate-limited, lockout-aware) that's safe
  // to reuse here purely for that verification.
  const generateWithPin = async (pin: string) => {
    if (!user) throw new Error('Please sign in again');
    const token = await user.getIdToken();
    const res  = await fetch('/api/wallet/pin/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Incorrect PIN');
    const mode: PinMode = data.mode;

    // Under duress mode, the statement must show the SAME scaled figures
    // the rest of the app shows — never the real ones. Previously this PDF
    // read tx.amount straight from the live data with no scaling at all,
    // meaning a duress-mode member's full real balance/history would print
    // regardless of what the on-screen wallet showed. Scale a copy of the
    // rows going into the PDF rather than touching any shared data.
    const scaledTxs: WalletTx[] = filtered.map(tx => ({
      ...tx,
      amount:  scaleForDisplay(tx.amount, mode),
      balance: tx.balance != null ? scaleForDisplay(tx.balance, mode) : tx.balance,
    }));

    const uid = (member as any).uid as string | undefined;
    if (!uid) throw new Error('Missing member id');
    const stmtId  = buildStmtId(member.ibiNumber, from, to);
    const authKey = await generateAuthKey(uid, member.ibiNumber, from, to);
    await generateStatementPdf(scaledTxs, member, from, to, authKey, stmtId);
  };

  const handle = () => {
    if (!filtered.length) return;
    setShowPinPrompt(true);
  };

  return (
    <div style={{ marginTop:'var(--space-lg)' }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        width:'100%', padding:'9px 16px',
        background:'var(--bg-card)', border:'1px solid var(--border-gold)',
        borderRadius:'var(--radius-md)', color:'var(--ibi-gold)', fontSize:'0.82rem', fontWeight:600, cursor:'pointer',
      }}>
        📄 Generate Statement PDF {open?'▲':'▼'}
      </button>

      {open && (
        <div style={{ marginTop:12, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'var(--space-lg)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">From</label>
              <input type="date" className="form-input" value={from} max={to} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">To</label>
              <input type="date" className="form-input" value={to} min={from} max={today} onChange={e => setTo(e.target.value)} />
            </div>
          </div>

          {filtered.length > 0 ? (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'12px 16px', marginBottom:'var(--space-md)', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
              <Stat label="Transactions" value={`${filtered.length}`}/>
              <Stat label="Total In"  value={`+₦${totalIn.toLocaleString('en-NG')}`}  color="#4ade80"/>
              <Stat label="Total Out" value={`-₦${totalOut.toLocaleString('en-NG')}`} color="var(--ibi-red-light)"/>
              <Stat label="Net"
                value={`${totalIn-totalOut>=0?'+':'-'}₦${Math.abs(totalIn-totalOut).toLocaleString('en-NG')}`}
                color={totalIn-totalOut>=0?'#4ade80':'var(--ibi-red-light)'}/>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'var(--space-lg)', color:'var(--text-muted)', fontSize:'0.88rem', background:'var(--bg-card)', borderRadius:'var(--radius-md)', marginBottom:'var(--space-md)' }}>
              No transactions in this period.
            </div>
          )}

          <button onClick={handle} disabled={busy||filtered.length===0}
            className="btn btn-primary"
            style={{ width:'100%', justifyContent:'center', gap:10, opacity:filtered.length===0?0.5:1 }}>
            {busy
              ? <><span className="spinner" style={{width:16,height:16}}/> Generating...</>
              : `Download Statement (${filtered.length} transaction${filtered.length!==1?'s':''})`}
          </button>
          <p style={{ textAlign:'center', fontSize:'0.7rem', color:'var(--text-muted)', marginTop:8 }}>
            Each statement includes a unique Auth Key — verifiable at igbobuigbo.org.ng/verify
          </p>
        </div>
      )}

      {showPinPrompt && (
        <PinConfirmModal
          title="Enter your PIN to download"
          subtitle="Required every time a statement is generated."
          onConfirm={async (pin) => {
            setBusy(true);
            try {
              await generateWithPin(pin);
              setShowPinPrompt(false);
            } finally {
              setBusy(false);
            }
          }}
          onCancel={() => setShowPinPrompt(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color='var(--text-primary)' }: { label:string; value:string; color?:string }) {
  return (
    <div style={{textAlign:'center'}}>
      <div style={{fontSize:'0.68rem',color:'var(--text-muted)',marginBottom:2}}>{label}</div>
      <div style={{fontSize:'0.88rem',fontWeight:700,color,fontFamily:'var(--font-mono)'}}>{value}</div>
    </div>
  );
}
