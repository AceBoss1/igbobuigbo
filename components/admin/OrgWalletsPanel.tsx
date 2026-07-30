// components/admin/OrgWalletsPanel.tsx
'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getAllChapters } from '@/lib/chapters-data';

interface OrgWallet {
  address: string; scope: string; scopeCode: string; scopeName: string;
  kind: 'main' | 'donation' | 'grant'; balance: number; walletDocId?: string;
}
interface OrgWalletTx {
  amount: number; description: string; ref: string; createdAt?: { seconds: number };
}

function kindLabel(kind: string) {
  return kind === 'main' ? 'Main Purse' : kind === 'grant' ? 'Grants' : 'Donations';
}

export default function OrgWalletsPanel() {
  const [national, setNational]   = useState<OrgWallet[]>([]);
  const [regional, setRegional]   = useState<OrgWallet[]>([]);
  const [remittance, setRemittance] = useState({ chapterToRegionPct: 20, regionToNationalPct: 25 });
  const [loading, setLoading]     = useState(true);
  const [chapterQuery, setChapterQuery] = useState('');
  const [chapterWallets, setChapterWallets] = useState<OrgWallet[] | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [creditTarget, setCreditTarget] = useState<OrgWallet | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDesc, setCreditDesc]     = useState('');
  const [crediting, setCrediting]       = useState(false);
  const [savingPct, setSavingPct]       = useState(false);
  const [historyFor, setHistoryFor]     = useState<string | null>(null); // walletDocId
  const [history, setHistory]           = useState<OrgWalletTx[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/org-wallets');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNational(data.national ?? []);
      setRegional(data.regional ?? []);
      setRemittance(data.remittance ?? remittance);
    } catch (e: any) { toast.error(e.message ?? 'Failed to load org wallets'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOverview(); }, []);

  const searchChapter = async (chapterName: string) => {
    if (!chapterName) { setChapterWallets(null); return; }
    setChapterLoading(true);
    try {
      const res = await fetch(`/api/admin/org-wallets?chapter=${encodeURIComponent(chapterName)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChapterWallets(data.wallets ?? []);
    } catch (e: any) { toast.error(e.message ?? 'Chapter lookup failed'); }
    finally { setChapterLoading(false); }
  };

  const submitCredit = async () => {
    if (!creditTarget) return;
    const amount = parseFloat(creditAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setCrediting(true);
    try {
      const res = await fetch('/api/admin/org-wallets/credit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: creditTarget.scope, scopeCode: creditTarget.scopeCode, kind: creditTarget.kind,
          amount, description: creditDesc || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Credited ₦${amount.toLocaleString()} to ${creditTarget.address}`);
      setCreditTarget(null); setCreditAmount(''); setCreditDesc('');
      fetchOverview();
      if (chapterQuery) searchChapter(chapterQuery);
    } catch (e: any) { toast.error(e.message ?? 'Credit failed'); }
    finally { setCrediting(false); }
  };

  const saveRemittance = async () => {
    setSavingPct(true);
    try {
      const res = await fetch('/api/admin/remittance-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(remittance),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Remittance settings saved');
    } catch (e: any) { toast.error(e.message ?? 'Save failed'); }
    finally { setSavingPct(false); }
  };

  const toggleHistory = async (w: OrgWallet) => {
    if (!w.walletDocId) return;
    if (historyFor === w.walletDocId) { setHistoryFor(null); return; }
    setHistoryFor(w.walletDocId);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/org-wallets/history?walletDocId=${encodeURIComponent(w.walletDocId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHistory(data.transactions ?? []);
    } catch (e: any) { toast.error(e.message ?? 'Failed to load history'); }
    finally { setHistoryLoading(false); }
  };

  const walletRow = (w: OrgWallet) => (
    <div key={w.address}>
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)',
        padding:'12px 16px', marginBottom: historyFor === w.walletDocId ? 0 : 8,
      }}>
        <div>
          <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ibi-gold)', fontSize:'0.9rem' }}>{w.address}</div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{w.scopeName} — {kindLabel(w.kind)}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>₦{w.balance.toLocaleString()}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleHistory(w)}>
            {historyFor === w.walletDocId ? 'Hide' : 'History'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCreditTarget(w)}>+ Credit</button>
        </div>
      </div>

      {historyFor === w.walletDocId && (
        <div style={{ border:'1px solid var(--border-subtle)', borderTop:'none', borderRadius:'0 0 var(--radius-md) var(--radius-md)', padding:'8px 16px 12px', marginBottom:8, background:'var(--bg-elevated)' }}>
          {historyLoading ? (
            <span className="spinner" style={{ width:14, height:14 }} />
          ) : history.length === 0 ? (
            <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', margin:'8px 0 0' }}>No transactions yet.</p>
          ) : (
            history.map((tx, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem', padding:'6px 0', borderBottom: i < history.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div>
                  <div style={{ color:'var(--text-primary)' }}>{tx.description}</div>
                  <div style={{ color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:'0.7rem' }}>
                    {tx.ref} {tx.createdAt ? `· ${new Date(((tx.createdAt as any).seconds ?? (tx.createdAt as any)._seconds ?? 0) * 1000).toLocaleString()}` : ''}
                  </div>
                </div>
                <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ibi-green, #4ade80)' }}>
                  +₦{tx.amount.toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  if (loading) return <div style={{ textAlign:'center', padding:'var(--space-xl)' }}><span className="spinner" /></div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-xl)' }}>
      <div className="card" style={{ padding:'var(--space-md) var(--space-lg)' }}>
        <p style={{ margin:0, fontSize:'0.8rem', color:'var(--text-muted)' }}>
          National, regional, and chapter purse wallets. Superadmin-managed for now —
          multi-signatory approval (3 excos per chapter/region) is planned for a later
          phase alongside chapter/region management (see TECH_DEBT_AND_ROADMAP.md).
        </p>
      </div>

      <div>
        <h4 style={{ marginBottom:12 }}>National Purse — IBI</h4>
        {national.map(walletRow)}
      </div>

      <div>
        <h4 style={{ marginBottom:12 }}>Regional Purses</h4>
        {regional.map(walletRow)}
      </div>

      <div>
        <h4 style={{ marginBottom:12 }}>Chapter Wallets — search by chapter</h4>
        <select
          className="form-select" value={chapterQuery}
          onChange={e => { setChapterQuery(e.target.value); searchChapter(e.target.value); }}
          style={{ marginBottom:12, maxWidth:340 }}
        >
          <option value="">Select a chapter…</option>
          {getAllChapters().map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {chapterLoading && <span className="spinner" style={{ width:16,height:16 }} />}
        {chapterWallets && chapterWallets.map(walletRow)}
      </div>

      <div className="card" style={{ padding:'var(--space-lg)' }}>
        <h4 style={{ marginBottom:12 }}>Remittance Percentages</h4>
        <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:16 }}>
          Stored for the automated monthly remittance job (Phase 2 — not yet built).
          Setting these now means it's ready to consume without a config migration later.
        </p>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">Chapter → Region %</label>
            <input type="number" className="form-input" style={{ width:120 }} min={0} max={100}
              value={remittance.chapterToRegionPct}
              onChange={e => setRemittance(r => ({ ...r, chapterToRegionPct: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">Region → National %</label>
            <input type="number" className="form-input" style={{ width:120 }} min={0} max={100}
              value={remittance.regionToNationalPct}
              onChange={e => setRemittance(r => ({ ...r, regionToNationalPct: parseFloat(e.target.value) || 0 }))} />
          </div>
          <button className="btn btn-gold" onClick={saveRemittance} disabled={savingPct}>
            {savingPct ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {creditTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'var(--space-lg)', maxWidth:380, width:'100%' }}>
            <h4 style={{ marginBottom:4 }}>Credit {creditTarget.address}</h4>
            <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:16 }}>{creditTarget.scopeName} — {kindLabel(creditTarget.kind)}</p>
            <div className="form-group">
              <label className="form-label">Amount (₦)</label>
              <input type="number" className="form-input" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="e.g. 50000" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <input className="form-input" value={creditDesc} onChange={e => setCreditDesc(e.target.value)} placeholder="e.g. Bank transfer — dues Q3" />
            </div>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setCreditTarget(null)} disabled={crediting}>Cancel</button>
              <button className="btn btn-gold" style={{ flex:1 }} onClick={submitCredit} disabled={crediting}>
                {crediting ? 'Crediting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
