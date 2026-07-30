// components/wallet/ReceiptTemplate.tsx
// Watermark is now the LAST element painted, with zIndex:100 and pointerEvents:none,
// so it sits visibly on top of every striped row background and coloured band.
'use client';
import React, { forwardRef } from 'react';

export interface ReceiptParty {
  type:       'member' | 'platform';
  name:       string;
  ibiNumber?: string;
}

export interface ReceiptData {
  referenceNo:     string;
  transactionType: 'credit' | 'debit';
  description:     string;
  dateTime:        Date | string;
  amount:          number;
  currency?:       string;
  balanceAfter?:   number;
  sender:          ReceiptParty;
  recipient:       ReceiptParty;
  logoDataUrl?:    string | null;
  qrDataUrl?:      string;
}

const fmt = (n: number) =>
  n.toLocaleString('en-NG', { minimumFractionDigits:2, maximumFractionDigits:2 });

const fmtDate = (d: Date | string) => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('en-NG', {
    weekday:'short', day:'numeric', month:'long',
    year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false,
  });
};

const ReceiptTemplate = forwardRef<HTMLDivElement, {
  data:         ReceiptData;
  showBalance?: boolean;
}>(({ data, showBalance = true }, ref) => {
  const isCredit = data.transactionType === 'credit';
  const symbol   = (data.currency ?? 'NGN') === 'USD' ? '$' : '₦';

  const rows: { label:string; value:string; sub?:string }[] = [
    { label:'Reference No.',    value: data.referenceNo },
    { label:'Transaction Type', value: isCredit ? 'Credit (Money In)' : 'Debit (Money Out)' },
    { label:'Description',      value: data.description },
    { label:'Date & Time',      value: fmtDate(data.dateTime) },
    { label:'Sender',    value: data.sender.name,    sub: data.sender.type    === 'member' ? data.sender.ibiNumber    : undefined },
    { label:'Recipient', value: data.recipient.name, sub: data.recipient.type === 'member' ? data.recipient.ibiNumber : undefined },
  ];

  return (
    <div
      ref={ref}
      id="ibi-receipt-root"
      style={{
        width: '794px',
        backgroundColor: '#ffffff',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        // Must be position:relative so the absolute watermark is contained here
        position: 'relative',
        overflow: 'hidden',
        color: '#111827',
      }}
    >
      {/* ── All receipt content ── */}
      <div>

        {/* HEADER */}
        <div style={{ backgroundColor:'#8B1A1A', padding:'20px 32px',
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:58, height:58, borderRadius:'50%', border:'3px solid #D4AF37',
              overflow:'hidden', flexShrink:0, backgroundColor:'#C8102E',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              {data.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.logoDataUrl} alt="IBI" width={58} height={58}
                  style={{ objectFit:'cover', width:'100%', height:'100%', display:'block' }} />
              ) : (
                <span style={{ color:'#D4AF37', fontWeight:900, fontSize:13,
                  fontFamily:'Georgia,serif', letterSpacing:2 }}>IBI</span>
              )}
            </div>
            <div>
              <div style={{ color:'#fff', fontSize:21, fontWeight:800, letterSpacing:1.5 }}>IGBO BU IGBO</div>
              <div style={{ color:'#D4AF37', fontSize:10, letterSpacing:2, marginTop:2 }}>
                UNITY &amp; CULTURAL PRESERVATION INITIATIVE
              </div>
            </div>
          </div>
          <div style={{ backgroundColor:'#fff', color:'#8B1A1A',
            padding:'8px 18px', fontSize:11, fontWeight:800, letterSpacing:1.5 }}>
            OFFICIAL RECEIPT
          </div>
        </div>

        {/* TRANSACTION BANNER */}
        <div style={{ backgroundColor: isCredit ? '#166534' : '#991b1b',
          padding:'13px 32px', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:18, color:'#fff' }}>{isCredit ? '↑' : '↓'}</span>
          <span style={{ color:'#fff', fontSize:15, fontWeight:800, letterSpacing:4 }}>
            {isCredit ? 'CREDIT — MONEY RECEIVED' : 'DEBIT — MONEY SENT'}
          </span>
        </div>

        {/* AMOUNT */}
        <div style={{ textAlign:'center', padding:'32px 32px 24px', backgroundColor:'#fafafa' }}>
          <div style={{ fontSize:52, fontWeight:800, lineHeight:1, letterSpacing:2,
            color: isCredit ? '#166534' : '#991b1b' }}>
            {isCredit ? '+' : '−'}&nbsp;{symbol}{fmt(data.amount)}
          </div>
          {showBalance && data.balanceAfter !== undefined && (
            <div style={{ fontSize:15, color:'#6b7280', marginTop:10, letterSpacing:1 }}>
              Balance after:&nbsp;&nbsp;{symbol}{fmt(data.balanceAfter)}
            </div>
          )}
        </div>

        {/* GOLD DIVIDER */}
        <div style={{ height:2, backgroundColor:'#D4AF37', margin:'0 32px' }} />

        {/* DETAILS TABLE */}
        <div style={{ padding:'8px 32px 20px' }}>
          {rows.map((row, i) => (
            <div key={row.label} style={{ display:'flex', justifyContent:'space-between',
              alignItems:'flex-start', padding:'13px 0',
              borderBottom:'1px solid #f0f0f0',
              backgroundColor: i % 2 !== 0 ? '#fafafa' : 'transparent' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#374151', minWidth:160, flexShrink:0 }}>
                {row.label}
              </span>
              <div style={{ textAlign:'right', maxWidth:490 }}>
                <div style={{ fontSize:13, color:'#111827', wordBreak:'break-word' }}>{row.value}</div>
                {row.sub && (
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:2, fontFamily:'Courier,monospace' }}>
                    {row.sub}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* GOLD DIVIDER */}
        <div style={{ height:2, backgroundColor:'#D4AF37', margin:'0 32px' }} />

        {/* ISSUER + QR */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'24px 32px' }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>
              Digitally Issued By:
            </div>
            <div style={{ fontSize:19, fontStyle:'italic', fontWeight:700, color:'#8B1A1A', marginBottom:6 }}>
              Igbo Bu Igbo Platform
            </div>
            <div style={{ fontSize:11, color:'#9ca3af' }}>
              System-generated — no physical signature required
            </div>
            <div style={{ fontSize:11, color:'#6b7280', marginTop:10 }}>
              Scan QR code to verify this receipt at igbobuigbo.org.ng/verify →
            </div>
          </div>
          <div style={{ border:'3px solid #8B1A1A', borderRadius:6, padding:6,
            backgroundColor:'#fff', width:128, height:128,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {data.qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.qrDataUrl} alt={`Verify ${data.referenceNo}`}
                style={{ width:'100%', height:'100%', display:'block' }} />
            ) : (
              <div style={{ fontSize:9, color:'#9ca3af', textAlign:'center', padding:4 }}>QR Code</div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ backgroundColor:'#8B1A1A', padding:'14px 32px', textAlign:'center' }}>
          <div style={{ color:'#D4AF37', fontSize:13, fontWeight:700, marginBottom:4 }}>
            igbobuigbo.org.ng
          </div>
          <div style={{ color:'#fff', fontSize:11, opacity:0.8 }}>
            info@igbobuigbo.org.ng &nbsp;·&nbsp; +234 (0) 806 787 1203 &nbsp;·&nbsp; National Secretariat, Enugu, Nigeria
          </div>
        </div>
      </div>

      {/*
        ── WATERMARK ──────────────────────────────────────────────────────────
        MUST be the very LAST element rendered inside the outer container.
        Being last in paint order + zIndex:100 ensures it sits visibly on top
        of the striped row backgrounds, the coloured banner, and every other
        element — while remaining transparent (opacity:0.055) so none of the
        underlying text or content is obscured.
        position:absolute with top/left 50% + translate(-50%,-50%) centres it
        perfectly regardless of the receipt height.
        pointerEvents:none stops it from blocking interactions in the preview.
      */}
      <div
        aria-hidden="true"
        style={{
          position:      'absolute',
          top:           '50%',
          left:          '50%',
          transform:     'translate(-50%, -50%) rotate(-45deg)',
          fontSize:      52,
          fontWeight:    900,
          color:         '#8B1A1A',
          opacity:       0.055,
          letterSpacing: 6,
          whiteSpace:    'nowrap',
          zIndex:        100,           // above ALL content including striped rows
          userSelect:    'none',
          pointerEvents: 'none',
        }}
      >
        OFFICIAL IBI RECEIPT
      </div>
    </div>
  );
});

ReceiptTemplate.displayName = 'ReceiptTemplate';
export default ReceiptTemplate;