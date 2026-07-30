// app/admin/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { usePricingSettings, invalidatePricingCache, DEFAULT_PRICING, type PricingSettings } from '@/lib/pricing';
import NotificationBell from '@/components/dashboard/NotificationBell';
import OrgWalletsPanel from '@/components/admin/OrgWalletsPanel';
import { getAllChapters } from '@/lib/chapters-data';

interface PendingMember {
  uid: string; displayName: string; email: string; phone: string;
  chapter: string; membershipTier: string; joinedAt: string; paystackRef: string;
}

interface ActiveMember extends PendingMember {
  ibiNumber: string; walletBalance: number; status: string;
  affiliateCode: string;
}

interface PendingTransfer {
  id: string; uid: string; ref: string; ibiNumber: string;
  fromChapter: string; toChapter: string; effectiveDate: string;
  reason: string; explanation: string; status: string;
  createdAt: { seconds: number };
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab,       setTab]       = useState<'pending'|'members'|'transfers'|'wallet'|'orgwallets'|'pricing'|'notifications'|'security'>('pending');
  const [pending,   setPending]   = useState<PendingMember[]>([]);
  const [members,   setMembers]   = useState<ActiveMember[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [fetching,  setFetching]  = useState(false);
  const [actionUid, setActionUid] = useState<string|null>(null);
  const [transferActionId, setTransferActionId] = useState<string|null>(null);

  // Wallet credit form
  const [walletUid,    setWalletUid]    = useState('');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletNote,   setWalletNote]   = useState('');
  const [crediting,    setCrediting]    = useState(false);

  // Superadmin gating for credit/debit
  const [adminRole, setAdminRole] = useState<'admin'|'superadmin'|null>(null);
  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/whoami', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setAdminRole((await res.json()).role);
      } catch { /* stays null — UI treats null as non-superadmin */ }
    })();
  }, [user]);
  const isSuperAdmin = adminRole === 'superadmin';

  // Debit wallet (superadmin only)
  const [debitUid,    setDebitUid]    = useState('');
  const [debitAmount, setDebitAmount] = useState('');
  const [debitNote,   setDebitNote]   = useState('');
  const [debiting,    setDebiting]    = useState(false);

  // Security tab — member lookup, PND, card restriction
  const [secLookupId, setSecLookupId] = useState('');
  const [secMember,   setSecMember]   = useState<any>(null);
  const [secLoading,  setSecLoading]  = useState(false);
  const [pndReason,   setPndReason]   = useState('');
  const [pndBusy,     setPndBusy]     = useState(false);
  const [cardReason,  setCardReason]  = useState('');
  const [cardBusy,    setCardBusy]    = useState<string | null>(null); // cardOrderId currently processing

  // Search
  const [search, setSearch] = useState('');

  // Pricing (settings/pricing — see lib/pricing.ts)
  const { pricing, loading: pricingLoading } = usePricingSettings();
  const [priceForm, setPriceForm] = useState<PricingSettings>(DEFAULT_PRICING);
  const [savingPrices, setSavingPrices] = useState(false);

  // Notifications (settings/pricing sibling feature — see lib/notifications.ts)
  const [notifTitle,    setNotifTitle]    = useState('');
  const [notifBody,     setNotifBody]     = useState('');
  const [notifLink,     setNotifLink]     = useState('');
  const [notifAudience, setNotifAudience] = useState<'all'|'user'|'region'|'chapter'>('all');
  const [notifTargetUid,setNotifTargetUid]= useState('');
  const [notifRegionId, setNotifRegionId] = useState('');
  const [notifChapter,  setNotifChapter]  = useState('');
  const [sendingNotif,  setSendingNotif]  = useState(false);

  useEffect(() => { setPriceForm(pricing); }, [pricing]);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (user) fetchData();
  }, [user, loading]);

  const fetchData = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/admin/members');
      if (res.status === 403) { toast.error('Admin access required'); router.replace('/'); return; }
      const data = await res.json();
      setPending(data.pending ?? []);
      setMembers(data.active  ?? []);
    } catch { toast.error('Failed to load members'); }
    try {
      const res = await fetch('/api/admin/transfers');
      if (res.ok) setPendingTransfers((await res.json()).pending ?? []);
    } catch { /* non-critical — transfers tab just shows empty on failure */ }
    finally { setFetching(false); }
  };

  const handleApprove = async (uid: string) => {
    setActionUid(uid);
    try {
      const res = await fetch('/api/admin/approve-member', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ memberUid: uid, action:'approve' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Approved! IBI: ${data.ibiNumber}`);
      fetchData();
    } catch (e:any) { toast.error(e.message); }
    finally { setActionUid(null); }
  };

  const handleReject = async (uid: string, reason: string) => {
    setActionUid(uid);
    try {
      const res = await fetch('/api/admin/approve-member', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ memberUid:uid, action:'reject', reason }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Member rejected');
      fetchData();
    } catch (e:any) { toast.error(e.message); }
    finally { setActionUid(null); }
  };

  const handleApproveTransfer = async (transferId: string) => {
    setTransferActionId(transferId);
    try {
      const res = await fetch('/api/admin/approve-transfer', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ transferId, action:'approve' }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Transfer approved');
      fetchData();
    } catch (e:any) { toast.error(e.message); }
    finally { setTransferActionId(null); }
  };

  const handleRejectTransfer = async (transferId: string, reason: string) => {
    setTransferActionId(transferId);
    try {
      const res = await fetch('/api/admin/approve-transfer', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ transferId, action:'reject', reason }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Transfer rejected');
      fetchData();
    } catch (e:any) { toast.error(e.message); }
    finally { setTransferActionId(null); }
  };

  const handleCreditWallet = async () => {
    const amount = parseFloat(walletAmount);
    if (!walletUid || !amount || amount <= 0) { toast.error('Enter IBI number/UID and amount'); return; }
    setCrediting(true);
    try {
      const res = await fetch('/api/admin/credit-wallet', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ identifier: walletUid, amount, note: walletNote || 'Admin credit' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`₦${amount.toLocaleString()} credited to ${data.displayName}`);
      setWalletUid(''); setWalletAmount(''); setWalletNote('');
      if (tab === 'members') fetchData();
    } catch (e:any) { toast.error(e.message); }
    finally { setCrediting(false); }
  };

  const handleDebitWallet = async () => {
    const amount = parseFloat(debitAmount);
    if (!debitUid || !amount || amount <= 0) { toast.error('Enter IBI number/UID and amount'); return; }
    if (!debitNote.trim()) { toast.error('A note is required for the audit trail'); return; }
    setDebiting(true);
    try {
      const res = await fetch('/api/admin/debit-wallet', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ identifier: debitUid, amount, note: debitNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`₦${amount.toLocaleString()} debited from ${data.displayName}`);
      setDebitUid(''); setDebitAmount(''); setDebitNote('');
      if (tab === 'members') fetchData();
    } catch (e:any) { toast.error(e.message); }
    finally { setDebiting(false); }
  };

  const handleSecLookup = async () => {
    if (!secLookupId.trim()) { toast.error('Enter an IBI number, email, or UID'); return; }
    setSecLoading(true); setSecMember(null);
    try {
      const res = await fetch(`/api/admin/member-lookup?id=${encodeURIComponent(secLookupId.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSecMember(data);
    } catch (e:any) { toast.error(e.message); }
    finally { setSecLoading(false); }
  };

  const handlePndToggle = async (action: 'set'|'clear') => {
    if (!secMember) return;
    if (action === 'set' && !pndReason.trim()) { toast.error('Enter a reason'); return; }
    setPndBusy(true);
    try {
      const res = await fetch('/api/admin/pnd', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ identifier: secMember.uid, action, reason: pndReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(action === 'set' ? 'PND restriction placed' : 'PND restriction cleared');
      setPndReason('');
      handleSecLookup(); // refresh
    } catch (e:any) { toast.error(e.message); }
    finally { setPndBusy(false); }
  };

  const handleCardRestrict = async (cardOrderId: string, action: 'restrict'|'unrestrict') => {
    if (action === 'restrict' && !cardReason.trim()) { toast.error('Enter a reason'); return; }
    setCardBusy(cardOrderId);
    try {
      const res = await fetch('/api/admin/cards/restrict', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ cardOrderId, action, reason: cardReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(action === 'restrict' ? 'Card restricted' : 'Card restriction cleared');
      setCardReason('');
      handleSecLookup(); // refresh
    } catch (e:any) { toast.error(e.message); }
    finally { setCardBusy(null); }
  };

  const handleSavePricing = async () => {
    setSavingPrices(true);
    try {
      const res = await fetch('/api/admin/pricing', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(priceForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      invalidatePricingCache(); // so this tab reflects the save immediately, not just after a refetch elsewhere
      toast.success('Pricing updated — changes are live sitewide');
    } catch (e: any) {
      toast.error(e.message ?? 'Could not save pricing');
    } finally {
      setSavingPrices(false);
    }
  };

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) { toast.error('Title and message are required'); return; }
    if (notifAudience === 'user' && !notifTargetUid) { toast.error('Pick a member to target'); return; }
    if (notifAudience === 'region' && !notifRegionId) { toast.error('Pick a region to target'); return; }
    if (notifAudience === 'chapter' && !notifChapter) { toast.error('Pick a chapter to target'); return; }
    setSendingNotif(true);
    try {
      const res = await fetch('/api/admin/notifications', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          title: notifTitle, body: notifBody, link: notifLink || undefined,
          audience: notifAudience,
          targetUid:  notifAudience==='user'    ? notifTargetUid : undefined,
          regionId:   notifAudience==='region'  ? notifRegionId  : undefined,
          chapterName:notifAudience==='chapter' ? notifChapter   : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const msg = typeof data.recipientCount === 'number'
        ? `Notification sent to ${data.recipientCount} member${data.recipientCount === 1 ? '' : 's'}`
        : notifAudience === 'all' ? 'Notification sent to all members' : 'Notification sent';
      toast.success(msg);
      setNotifTitle(''); setNotifBody(''); setNotifLink(''); setNotifTargetUid(''); setNotifRegionId(''); setNotifChapter('');
    } catch (e: any) {
      toast.error(e.message ?? 'Could not send notification');
    } finally {
      setSendingNotif(false);
    }
  };

  const TAB = (id: typeof tab, label: string, count?: number) => (
    <button onClick={()=>setTab(id)} style={{
      padding:'10px 20px', background: tab===id ? 'var(--bg-card)' : 'transparent',
      border:'none', borderBottom:`2px solid ${tab===id ? 'var(--ibi-gold)' : 'transparent'}`,
      color: tab===id ? 'var(--ibi-gold)' : 'var(--text-muted)',
      fontWeight: tab===id ? 600 : 400, fontSize:'0.88rem', cursor:'pointer', transition:'all 0.2s',
      display:'flex', alignItems:'center', gap:8,
    }}>
      {label}
      {count !== undefined && count > 0 && (
        <span style={{ background:'var(--ibi-red)', color:'#fff', borderRadius:99, padding:'1px 7px', fontSize:'0.68rem', fontWeight:700 }}>{count}</span>
      )}
    </button>
  );

  const filteredMembers = members.filter(m =>
    !search || m.displayName.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    (m.ibiNumber ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight:'100vh', paddingTop:80, background:'var(--bg-primary)' }}>
      <div className="container" style={{ maxWidth:1200 }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-xl)', flexWrap:'wrap', gap:'var(--space-md)' }}>
          <div>
            <div className="section-label">Administration</div>
            <h2 style={{ marginBottom:4 }}>IBI Admin Panel</h2>
            <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', margin:0 }}>
              {pending.length} pending · {members.length} active members
            </p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'var(--space-sm)' }}>
            <NotificationBell />
            <button className="btn btn-ghost btn-sm" onClick={fetchData} disabled={fetching}>
              {fetching ? <><span className="spinner" style={{ width:14,height:14 }} /> Loading…</> : '↻ Refresh'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border-subtle)', overflow:'hidden', marginBottom:'var(--space-lg)' }}>
          <div style={{ display:'flex', borderBottom:'1px solid var(--border-subtle)' }}>
            {TAB('pending', '⏳ Pending Approvals', pending.length)}
            {TAB('members', '👥 Active Members')}
            {TAB('transfers', '🔁 Chapter Transfers', pendingTransfers.length)}
            {TAB('orgwallets', '🏦 Org Wallets')}
            {TAB('wallet',  '💰 Credit Wallet')}
            {TAB('pricing', '🏷️ Pricing')}
            {TAB('notifications', '🔔 Notifications')}
            {TAB('security', '🛡️ Security (PND)')}
          </div>

          <div style={{ padding:'var(--space-lg)' }}>

            {/* ── PENDING ─────────────────────────────────────── */}
            {tab==='pending' && (
              pending.length === 0 ? (
                <div style={{ textAlign:'center', padding:'var(--space-2xl)', color:'var(--text-muted)' }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:12 }}>✅</div>
                  <h4 style={{ marginBottom:8 }}>No pending applications</h4>
                  <p style={{ margin:0, fontSize:'0.85rem' }}>All caught up!</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {pending.map(m => (
                    <div key={m.uid} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'var(--space-lg)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'var(--space-md)' }}>
                      <div style={{ flex:1, minWidth:200 }}>
                        <div style={{ fontWeight:600, color:'var(--text-primary)', fontSize:'0.95rem' }}>{m.displayName}</div>
                        <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:4, display:'flex', gap:16, flexWrap:'wrap' }}>
                          <span>✉️ {m.email}</span>
                          {m.phone && <span>📞 {m.phone}</span>}
                          <span>📍 {m.chapter}</span>
                          <span className={`badge ${m.membershipTier==='student'||m.membershipTier==='youth' ? 'badge-green' : 'badge-gold'}`} style={{ fontSize:'0.62rem' }}>
                            {m.membershipTier}
                          </span>
                        </div>
                        <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:4, fontFamily:'var(--font-mono)' }}>
                          Applied: {m.joinedAt ? new Date(m.joinedAt).toLocaleString() : '—'} · Ref: {m.paystackRef ?? 'FREE'}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApprove(m.uid)}
                          disabled={actionUid === m.uid}
                          style={{ gap:6 }}
                        >
                          {actionUid===m.uid ? <span className="spinner" style={{ width:12,height:12 }} /> : '✓'} Approve
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            const reason = prompt(`Reject reason for ${m.displayName}?`) ?? '';
                            if (reason) handleReject(m.uid, reason);
                          }}
                          disabled={actionUid === m.uid}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── MEMBERS ──────────────────────────────────────── */}
            {tab==='members' && (
              <div>
                <input
                  className="form-input"
                  value={search}
                  onChange={e=>setSearch(e.target.value)}
                  placeholder="Search by name, email, or IBI number…"
                  style={{ marginBottom:'var(--space-lg)', maxWidth:400 }}
                />
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom:'2px solid var(--border-subtle)' }}>
                        {['IBI Number','Name','Email','Chapter','Tier','Wallet','Status','Actions'].map(h => (
                          <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'var(--text-muted)', fontWeight:600, fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((m, i) => (
                        <tr key={m.uid} style={{ borderBottom:'1px solid var(--border-subtle)', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                          <td style={{ padding:'10px 12px', fontFamily:'var(--font-mono)', color:'var(--ibi-gold)', fontSize:'0.78rem', whiteSpace:'nowrap' }}>{m.ibiNumber}</td>
                          <td style={{ padding:'10px 12px', color:'var(--text-primary)', fontWeight:500 }}>{m.displayName}</td>
                          <td style={{ padding:'10px 12px', color:'var(--text-secondary)' }}>{m.email}</td>
                          <td style={{ padding:'10px 12px', color:'var(--text-secondary)', fontSize:'0.78rem' }}>{m.chapter}</td>
                          <td style={{ padding:'10px 12px' }}>
                            <span className={`badge ${m.membershipTier==='patron' ? 'badge-red' : m.membershipTier==='student'||m.membershipTier==='youth' ? 'badge-green' : 'badge-gold'}`} style={{ fontSize:'0.62rem', textTransform:'capitalize' }}>
                              {m.membershipTier}
                            </span>
                          </td>
                          <td style={{ padding:'10px 12px', fontFamily:'var(--font-mono)', color:'#4ade80', fontWeight:600 }}>₦{(m.walletBalance??0).toLocaleString()}</td>
                          <td style={{ padding:'10px 12px' }}>
                            <span className={`badge ${m.status==='active' ? 'badge-green' : 'badge-gold'}`} style={{ fontSize:'0.62rem' }}>
                              {m.status}
                            </span>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => { setWalletUid(m.uid); setTab('wallet'); }}
                              style={{ fontSize:'0.7rem', padding:'4px 10px' }}
                            >
                              💰 Credit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredMembers.length === 0 && (
                    <div style={{ textAlign:'center', padding:'var(--space-xl)', color:'var(--text-muted)' }}>No members found</div>
                  )}
                </div>
              </div>
            )}

            {/* ── CHAPTER TRANSFERS ────────────────────────────── */}
            {tab==='transfers' && (
              pendingTransfers.length === 0 ? (
                <div style={{ textAlign:'center', padding:'var(--space-2xl)', color:'var(--text-muted)' }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:12 }}>✅</div>
                  <h4 style={{ marginBottom:8 }}>No pending transfer applications</h4>
                  <p style={{ margin:0, fontSize:'0.85rem' }}>All caught up!</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {pendingTransfers.map(t => (
                    <div key={t.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'var(--space-lg)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'var(--space-md)' }}>
                      <div style={{ flex:1, minWidth:240 }}>
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'var(--ibi-gold)', marginBottom:4 }}>Ref: {t.ref}</div>
                        <div style={{ fontWeight:600, color:'var(--text-primary)', fontSize:'0.95rem', marginBottom:4 }}>
                          {t.ibiNumber} — {t.fromChapter} → {t.toChapter}
                        </div>
                        <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:4 }}>
                          📌 {t.reason} · ⏰ Effective: {t.effectiveDate} · 📅 Applied: {t.createdAt ? new Date(t.createdAt.seconds*1000).toLocaleDateString() : '—'}
                        </div>
                        <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', lineHeight:1.5, maxWidth:520 }}>
                          {t.explanation}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApproveTransfer(t.id)}
                          disabled={transferActionId === t.id}
                          style={{ gap:6 }}
                        >
                          {transferActionId===t.id ? <span className="spinner" style={{ width:12,height:12 }} /> : '✓'} Approve
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            const reason = prompt(`Reject reason for ${t.ibiNumber}'s transfer to ${t.toChapter}?`) ?? '';
                            if (reason) handleRejectTransfer(t.id, reason);
                          }}
                          disabled={transferActionId === t.id}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── ORG WALLETS ──────────────────────────────────── */}
            {tab==='orgwallets' && <OrgWalletsPanel />}

            {/* ── CREDIT WALLET ────────────────────────────────── */}
            {tab==='wallet' && (
              <div style={{ maxWidth:480 }}>
                {!isSuperAdmin ? (
                  <div className="card card-red" style={{ padding:'var(--space-lg)' }}>
                    <p style={{ margin:0 }}>
                      <strong>Superadmin access required.</strong> Crediting and debiting wallets
                      directly is restricted to superadmins. If this should be you, ask an
                      existing superadmin to promote your account via
                      <code style={{ margin:'0 4px' }}>/api/admin/set-admin</code>
                      with <code>role: "superadmin"</code>.
                    </p>
                  </div>
                ) : (
                <>
                <h4 style={{ marginBottom:'var(--space-lg)' }}>Credit Member Wallet</h4>
                <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:'var(--space-lg)' }}>
                  Directly credit any member's IBI Wallet. Use this to seed initial balances, process manual payments, or issue refunds without Paystack.
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label">Member UID or IBI Number</label>
                    <input
                      className="form-input"
                      value={walletUid}
                      onChange={e=>setWalletUid(e.target.value)}
                      placeholder="e.g. LAG/3847291056 or Firebase UID"
                      style={{ fontFamily:'var(--font-mono)' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount (₦)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={walletAmount}
                      onChange={e=>setWalletAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      min={1}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Note / Reason</label>
                    <input
                      className="form-input"
                      value={walletNote}
                      onChange={e=>setWalletNote(e.target.value)}
                      placeholder="e.g. Welcome bonus, Manual payment, etc."
                    />
                  </div>
                  <button className="btn btn-gold" onClick={handleCreditWallet} disabled={crediting} style={{ gap:10 }}>
                    {crediting ? <><span className="spinner" style={{ width:16,height:16 }} /> Crediting…</> : `💰 Credit ₦${parseFloat(walletAmount||'0').toLocaleString()} to Wallet`}
                  </button>
                </div>

                <h4 style={{ margin:'var(--space-2xl) 0 var(--space-lg)' }}>Debit Member Wallet</h4>
                <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:'var(--space-lg)' }}>
                  Correct an erroneous credit or reverse confirmed fraud. This bypasses any PND
                  restriction on the account — it's an admin fixing the ledger, not the member
                  moving money. A note is required for every debit.
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label">Member UID or IBI Number</label>
                    <input className="form-input" value={debitUid} onChange={e=>setDebitUid(e.target.value)} placeholder="e.g. LAG/3847291056 or Firebase UID" style={{ fontFamily:'var(--font-mono)' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount (₦)</label>
                    <input type="number" className="form-input" value={debitAmount} onChange={e=>setDebitAmount(e.target.value)} placeholder="e.g. 5000" min={1} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Note / Reason (required)</label>
                    <input className="form-input" value={debitNote} onChange={e=>setDebitNote(e.target.value)} placeholder="e.g. Reversing erroneous credit from..." />
                  </div>
                  <button className="btn btn-ghost" onClick={handleDebitWallet} disabled={debiting} style={{ gap:10, borderColor:'var(--ibi-red-light)', color:'var(--ibi-red-light)' }}>
                    {debiting ? <><span className="spinner" style={{ width:16,height:16 }} /> Debiting…</> : `➖ Debit ₦${parseFloat(debitAmount||'0').toLocaleString()} from Wallet`}
                  </button>
                </div>
                </>
                )}
              </div>
            )}

            {/* ── PRICING ──────────────────────────────────────── */}
            {tab==='pricing' && (
              <div style={{ maxWidth:560 }}>
                <h4 style={{ marginBottom:6 }}>Registration Fees & Commission</h4>
                <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:'var(--space-lg)' }}>
                  Single source of truth for pricing sitewide — the membership page, upgrade
                  modal, affiliate commission table, and referral payouts all read from this
                  same <code>settings/pricing</code> document. Saving here updates all of them
                  immediately, no redeploy needed.
                </p>

                {pricingLoading ? (
                  <div style={{ padding:'var(--space-xl)', textAlign:'center' }}>
                    <div className="spinner" style={{ borderColor:'var(--border-gold)', borderTopColor:'var(--ibi-gold)', margin:'0 auto' }} />
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>

                    <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                      Registration Fees
                    </div>

                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
                      <div className="form-group">
                        <label className="form-label">Professional (₦)</label>
                        <input type="number" className="form-input" min={0}
                          value={priceForm.registrationFees.professional}
                          onChange={e => setPriceForm(f => ({ ...f, registrationFees:{ ...f.registrationFees, professional: Number(e.target.value) } }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Business (₦)</label>
                        <input type="number" className="form-input" min={0}
                          value={priceForm.registrationFees.business}
                          onChange={e => setPriceForm(f => ({ ...f, registrationFees:{ ...f.registrationFees, business: Number(e.target.value) } }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Patron (₦)</label>
                        <input type="number" className="form-input" min={0}
                          value={priceForm.registrationFees.patron}
                          onChange={e => setPriceForm(f => ({ ...f, registrationFees:{ ...f.registrationFees, patron: Number(e.target.value) } }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Diaspora ($)</label>
                        <input type="number" className="form-input" min={0}
                          value={priceForm.registrationFees.diasporaUSD}
                          onChange={e => setPriceForm(f => ({ ...f, registrationFees:{ ...f.registrationFees, diasporaUSD: Number(e.target.value) } }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Student (₦)</label>
                        <input type="number" className="form-input" min={0}
                          value={priceForm.registrationFees.student}
                          onChange={e => setPriceForm(f => ({ ...f, registrationFees:{ ...f.registrationFees, student: Number(e.target.value) } }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Youth (₦)</label>
                        <input type="number" className="form-input" min={0}
                          value={priceForm.registrationFees.youth}
                          onChange={e => setPriceForm(f => ({ ...f, registrationFees:{ ...f.registrationFees, youth: Number(e.target.value) } }))}
                        />
                      </div>
                    </div>

                    <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginTop:'var(--space-sm)' }}>
                      Commission Rates
                    </div>

                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
                      <div className="form-group">
                        <label className="form-label">Affiliate Commission (%)</label>
                        <input type="number" className="form-input" min={0} max={100} step={1}
                          value={Math.round(priceForm.commissionRate * 100)}
                          onChange={e => setPriceForm(f => ({ ...f, commissionRate: Number(e.target.value) / 100 }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Marketplace Fee (%)</label>
                        <input type="number" className="form-input" min={0} max={100} step={1}
                          value={Math.round(priceForm.marketplaceRate * 100)}
                          onChange={e => setPriceForm(f => ({ ...f, marketplaceRate: Number(e.target.value) / 100 }))}
                        />
                      </div>
                    </div>

                    <button className="btn btn-gold" onClick={handleSavePricing} disabled={savingPrices} style={{ gap:10, marginTop:'var(--space-sm)' }}>
                      {savingPrices ? <><span className="spinner" style={{ width:16,height:16 }} /> Saving…</> : '💾 Save Pricing'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── NOTIFICATIONS ────────────────────────────────── */}
            {tab==='notifications' && (
              <div style={{ maxWidth:560 }}>
                <h4 style={{ marginBottom:6 }}>Send a Notification</h4>
                <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:'var(--space-lg)' }}>
                  Appears in the bell icon in every recipient's dashboard. Same system this
                  will use for future IBI Ads pushes — just a different audience/type later.
                </p>

                <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label">Audience</label>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button onClick={() => setNotifAudience('all')} className={`btn ${notifAudience==='all' ? 'btn-gold' : 'btn-ghost'}`} style={{ flex:1 }}>All Members</button>
                      <button onClick={() => setNotifAudience('user')} className={`btn ${notifAudience==='user' ? 'btn-gold' : 'btn-ghost'}`} style={{ flex:1 }}>Specific Member</button>
                      <button onClick={() => setNotifAudience('region')} className={`btn ${notifAudience==='region' ? 'btn-gold' : 'btn-ghost'}`} style={{ flex:1 }}>Specific Region</button>
                      <button onClick={() => setNotifAudience('chapter')} className={`btn ${notifAudience==='chapter' ? 'btn-gold' : 'btn-ghost'}`} style={{ flex:1 }}>Specific Chapter</button>
                    </div>
                  </div>

                  {notifAudience === 'region' && (
                    <div className="form-group">
                      <label className="form-label">Target Region</label>
                      <select className="form-input" value={notifRegionId} onChange={e => setNotifRegionId(e.target.value)}>
                        <option value="">Select a region…</option>
                        <option value="ig">Region 1 — Igbo Speaking States</option>
                        <option value="ni">Region 2 — Non-Igbo States & FCT</option>
                        <option value="di">Region 3 — Global Diaspora</option>
                      </select>
                    </div>
                  )}

                  {notifAudience === 'chapter' && (
                    <div className="form-group">
                      <label className="form-label">Target Chapter</label>
                      <select className="form-input" value={notifChapter} onChange={e => setNotifChapter(e.target.value)}>
                        <option value="">Select a chapter…</option>
                        {getAllChapters().map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                  )}

                  {notifAudience === 'user' && (
                    <div className="form-group">
                      <label className="form-label">Target Member</label>
                      <select className="form-input" value={notifTargetUid} onChange={e => setNotifTargetUid(e.target.value)}>
                        <option value="">Select a member…</option>
                        {members.map(m => (
                          <option key={m.uid} value={m.uid}>{m.displayName} — {m.ibiNumber}</option>
                        ))}
                      </select>
                      <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:4 }}>
                        List is populated from the Active Members tab — visit it first if empty.
                      </p>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input className="form-input" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="e.g. Scheduled maintenance tonight" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Message</label>
                    <textarea className="form-textarea" rows={3} value={notifBody} onChange={e => setNotifBody(e.target.value)} placeholder="Keep it short — this shows in a dropdown list." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Link (optional)</label>
                    <input className="form-input" value={notifLink} onChange={e => setNotifLink(e.target.value)} placeholder="/dashboard/wallet" />
                  </div>

                  <button className="btn btn-gold" onClick={handleSendNotification} disabled={sendingNotif} style={{ gap:10, marginTop:'var(--space-sm)' }}>
                    {sendingNotif ? <><span className="spinner" style={{ width:16,height:16 }} /> Sending…</> : '🔔 Send Notification'}
                  </button>
                </div>
              </div>
            )}

            {/* ── SECURITY (PND) ──────────────────────────────────────── */}
            {tab==='security' && (
              <div style={{ maxWidth:560 }}>
                <h4 style={{ marginBottom:6 }}>Member Security</h4>
                <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:'var(--space-lg)' }}>
                  Look up a member to place or clear a PND (Post No Debit) restriction, or
                  restrict a specific issued card. Available to any admin — these are protective
                  actions, not money movement, so this isn't superadmin-gated like credit/debit.
                </p>

                <div style={{ display:'flex', gap:8, marginBottom:'var(--space-lg)' }}>
                  <input className="form-input" value={secLookupId} onChange={e=>setSecLookupId(e.target.value)}
                    placeholder="IBI number, email, or UID" style={{ fontFamily:'var(--font-mono)' }}
                    onKeyDown={e => e.key === 'Enter' && handleSecLookup()} />
                  <button className="btn btn-gold" onClick={handleSecLookup} disabled={secLoading} style={{ flexShrink:0 }}>
                    {secLoading ? <span className="spinner" style={{ width:16,height:16 }} /> : 'Look Up'}
                  </button>
                </div>

                {secMember && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-lg)' }}>
                    <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'var(--space-md)' }}>
                      <div style={{ fontWeight:600, marginBottom:2 }}>{secMember.displayName}</div>
                      <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginBottom:8 }}>
                        {secMember.ibiNumber} · {secMember.email}
                      </div>
                      <div style={{ fontSize:'0.85rem' }}>
                        Balance: <strong>₦{secMember.walletBalance.toLocaleString()}</strong>
                      </div>
                      <div style={{ marginTop:8 }}>
                        <span className={`badge ${secMember.pndStatus === 'active' ? 'badge-red' : 'badge-green'}`}>
                          {secMember.pndStatus === 'active' ? `PND ACTIVE — ${secMember.pndReason}` : 'No restriction'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>
                        Wallet PND
                      </div>
                      {secMember.pndStatus === 'active' ? (
                        <button className="btn btn-gold" onClick={() => handlePndToggle('clear')} disabled={pndBusy}>
                          {pndBusy ? <span className="spinner" style={{ width:16,height:16 }} /> : '✅ Clear PND Restriction'}
                        </button>
                      ) : (
                        <div style={{ display:'flex', gap:8 }}>
                          <input className="form-input" value={pndReason} onChange={e=>setPndReason(e.target.value)} placeholder="Reason (required)" />
                          <button className="btn btn-ghost" onClick={() => handlePndToggle('set')} disabled={pndBusy} style={{ flexShrink:0, borderColor:'var(--ibi-red-light)', color:'var(--ibi-red-light)' }}>
                            {pndBusy ? <span className="spinner" style={{ width:16,height:16 }} /> : '🚫 Place PND'}
                          </button>
                        </div>
                      )}
                      <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:6 }}>
                        Blocks this member from sending or spending. They can still see their
                        balance and still receive money.
                      </p>
                    </div>

                    {secMember.cards.length > 0 && (
                      <div>
                        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>
                          Cards
                        </div>
                        <input className="form-input" value={cardReason} onChange={e=>setCardReason(e.target.value)} placeholder="Reason for restricting (used for any card below)" style={{ marginBottom:8 }} />
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          {secMember.cards.map((c: any) => (
                            <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)' }}>
                              <div>
                                <div style={{ fontSize:'0.85rem', fontWeight:600 }}>{c.cardType} — {c.cardTier}</div>
                                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                                  {c.restricted ? `Restricted — ${c.restrictedReason}` : `Status: ${c.status}`}
                                </div>
                              </div>
                              <button
                                className="btn btn-ghost btn-sm"
                                disabled={cardBusy === c.id}
                                onClick={() => handleCardRestrict(c.id, c.restricted ? 'unrestrict' : 'restrict')}
                                style={c.restricted ? {} : { borderColor:'var(--ibi-red-light)', color:'var(--ibi-red-light)' }}
                              >
                                {cardBusy === c.id ? <span className="spinner" style={{ width:14,height:14 }} /> : (c.restricted ? 'Unrestrict' : 'Restrict')}
                              </button>
                            </div>
                          ))}
                        </div>
                        <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:6 }}>
                          Updates IBI's own record only — not a real-time network freeze at the
                          card issuer. That needs the Sudo Africa integration to be live.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
