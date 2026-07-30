// app/dashboard/profile/page.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth }       from '@/lib/AuthContext';
import { updateProfile } from 'firebase/auth';
import { auth }          from '@/lib/firebase';
import toast             from 'react-hot-toast';

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Gombe','Imo','Jigawa',
  'Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger',
  'Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe',
  'Zamfara','FCT Abuja',
];
const TRADES = [
  'Trading / Commerce','Real Estate','Agriculture','Technology','Healthcare',
  'Education','Finance / Banking','Manufacturing','Transport / Logistics',
  'Hospitality','Professional Services','Arts / Media','Other',
];
const BLOOD_TYPES    = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const RELATIONSHIPS  = ['Spouse','Parent','Sibling','Child','Relative','Friend','Other'];

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ title, subtitle, onEdit, editing, children }: {
  title:    string; subtitle?: string;
  onEdit?:  () => void; editing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-xl)', overflow:'hidden', marginBottom:'var(--space-md)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'18px 24px 0' }}>
        <div>
          <h4 style={{ margin:0, fontSize:'0.98rem', color:'var(--text-primary)' }}>{title}</h4>
          {subtitle && <p style={{ margin:'3px 0 0', fontSize:'0.78rem', color:'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        {onEdit && !editing && (
          <button onClick={onEdit} style={{ background:'none', border:'none', color:'var(--ibi-gold)', fontSize:'0.84rem', fontWeight:600, cursor:'pointer', padding:'2px 0', marginTop:2 }}>
            Edit profile info
          </button>
        )}
      </div>
      <div style={{ padding:'0 24px 20px' }}>{children}</div>
    </div>
  );
}

// ─── Row — label / value — Microsoft Account style ────────────────────────────
function Row({ label, value, hint }: { label:string; value?:React.ReactNode; hint?:string }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'13px 0', borderBottom:'1px solid var(--border-subtle)', gap:16 }}>
      <span style={{ flex:'0 0 180px', fontSize:'0.85rem', color:'var(--text-secondary)', paddingTop:2 }}>{label}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'0.9rem', fontWeight:600, color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: value ? 'normal' : 'italic' }}>
          {value || 'Not set'}
        </div>
        {hint && <div style={{ fontSize:'0.73rem', color:'var(--text-muted)', marginTop:3 }}>{hint}</div>}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { member, refreshMember } = useAuth();
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [f, setF] = useState({
    displayName:'', phone:'', trade:'', state:'', address:'',
    gender:'', bloodType:'', nationality:'Nigeria',
    businessName:'', position:'', nin:'', businessTaxId:'',
    nokName:'', nokRel:'', nokPhone:'', nokEmail:'',
  });
  const set = (k: keyof typeof f, v: string) => setF(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!member) return;
    const m = member as any;
    setF({
      displayName:  member.displayName    ?? '',
      phone:        member.phone          ?? '',
      trade:        member.trade          ?? '',
      state:        member.state          ?? '',
      address:      member.address        ?? '',
      gender:       m.gender              ?? '',
      bloodType:    m.bloodType           ?? '',
      nationality:  m.nationality         ?? 'Nigeria',
      businessName: m.businessName        ?? '',
      position:     m.position            ?? '',
      nin:          m.nin                 ?? '',
      businessTaxId:m.businessTaxId       ?? '',
      nokName:      m.nextOfKin?.name     ?? '',
      nokRel:       m.nextOfKin?.relationship ?? '',
      nokPhone:     m.nextOfKin?.phone    ?? '',
      nokEmail:     m.nextOfKin?.email    ?? '',
    });
  }, [member]);

  const save = async (fields: Record<string, any>, label: string) => {
    setSaving(true);
    try {
      if (auth && fields.displayName && auth.currentUser && fields.displayName !== member?.displayName)
        await updateProfile(auth.currentUser, { displayName: fields.displayName });
      const res  = await fetch('/api/member/update', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Update failed');
      await refreshMember();
      toast.success(`${label} updated!`);
      setEditing(null);
    } catch (e: any) { toast.error(e.message ?? 'Update failed'); }
    finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2 MB'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'ibi_uploads');
      fd.append('folder', 'ibi/members');
      const cn = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      if (!cn) throw new Error('Cloudinary not configured');
      const res  = await fetch(`https://api.cloudinary.com/v1_1/${cn}/image/upload`, { method:'POST', body:fd });
      const data = await res.json();
      if (!data.secure_url) throw new Error('Upload failed');
      if (auth && auth.currentUser) await updateProfile(auth.currentUser, { photoURL: data.secure_url });
      await fetch('/api/member/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ photoURL: data.secure_url }) });
      await refreshMember();
      toast.success('Photo updated!');
    } catch (e: any) { toast.error(e.message ?? 'Photo upload failed'); }
    finally { setSaving(false); }
  };

  const initials = member?.displayName?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() ?? 'M';
  const m = member as any;

  const SaveCancel = ({ label, fields }: { label:string; fields:Record<string,any> }) => (
    <div style={{ display:'flex', gap:8, marginTop:16 }}>
      <button className="btn btn-gold btn-sm" disabled={saving} onClick={() => save(fields, label)}>
        {saving ? <><span className="spinner" style={{ width:12,height:12 }} /> Saving…</> : 'Save'}
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
    </div>
  );

  return (
    <div style={{ maxWidth:700 }}>
      <div style={{ marginBottom:'var(--space-xl)' }}>
        <div className="section-label">My Account</div>
        <h2 style={{ marginBottom:4 }}>My Profile</h2>
        <p style={{ color:'var(--text-muted)', fontSize:'0.88rem' }}>
          Manage your community, wallet, insurance and marketplace identity information.
        </p>
      </div>

      {/* ── Hero ── */}
      <div style={{ display:'flex', alignItems:'center', gap:24, padding:'0 0 var(--space-xl)', borderBottom:'1px solid var(--border-subtle)', marginBottom:'var(--space-lg)' }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <div style={{
            width:96, height:96, borderRadius:'50%',
            backgroundImage: member?.photoURL ? `url(${member.photoURL})` : undefined,
            backgroundSize:'cover', backgroundPosition:'center',
            background: member?.photoURL ? undefined : 'var(--grad-red)',
            border:'3px solid var(--ibi-gold)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'2rem', fontWeight:700, color:'#fff', fontFamily:'var(--font-display)',
            overflow:'hidden',
          }}>
            {!member?.photoURL && initials}
          </div>
          <button onClick={() => fileRef.current?.click()} title="Change photo" style={{ position:'absolute', bottom:0, right:0, width:28, height:28, borderRadius:'50%', background:'var(--ibi-gold)', border:'2px solid var(--bg-primary)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:'0.75rem' }}>
            ✏️
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoUpload} />
        </div>
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'1.35rem', fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>{member?.displayName}</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.9rem', color:'var(--ibi-gold)', marginBottom:10 }}>{member?.ibiNumber ?? 'Pending approval'}</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <span className={`badge ${member?.status==='active'?'badge-green':'badge-gold'}`}>{member?.status==='active'?'● Active':'● Pending'}</span>
            <span className="badge badge-gold" style={{ textTransform:'capitalize' }}>{member?.membershipTier}</span>
            {member?.chapter && <span className="badge" style={{ background:'var(--bg-elevated)', color:'var(--text-secondary)', border:'1px solid var(--border-subtle)', textTransform:'none', letterSpacing:0 }}>{member.chapter}</span>}
          </div>
        </div>
      </div>

      {/* ══ 1. Profile Info ══════════════════════════════════════════════════ */}
      <SectionCard title="Profile Info" onEdit={() => setEditing('profile')} editing={editing==='profile'}>
        {editing==='profile' ? (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16 }}>
              <div className="form-group"><label className="form-label">Full Name</label>
                <input className="form-input" value={f.displayName} onChange={e=>set('displayName',e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Gender</label>
                <select className="form-select" value={f.gender} onChange={e=>set('gender',e.target.value)}>
                  <option value="">Select</option><option>Male</option><option>Female</option>
                </select></div>
              <div className="form-group"><label className="form-label">Blood Type</label>
                <select className="form-select" value={f.bloodType} onChange={e=>set('bloodType',e.target.value)}>
                  <option value="">Select</option>{BLOOD_TYPES.map(b=><option key={b}>{b}</option>)}
                </select></div>
              <div className="form-group"><label className="form-label">Nationality</label>
                <input className="form-input" value={f.nationality} onChange={e=>set('nationality',e.target.value)} placeholder="Nigeria" /></div>
            </div>
            <SaveCancel label="Profile info" fields={{ displayName:f.displayName, gender:f.gender, bloodType:f.bloodType, nationality:f.nationality }} />
          </>
        ) : (
          <div style={{ marginTop:4 }}>
            <Row label="Full name"    value={member?.displayName} />
            <Row label="Date of birth" value={member?.dob ? new Date(member.dob).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) : undefined} hint="Used for birthday wishes & age verification" />
            <Row label="Gender"       value={m?.gender} />
            <Row label="Blood type"   value={m?.bloodType} hint="Shown on ID card emergency contact section" />
            <Row label="Nationality"  value={m?.nationality ?? 'Nigeria'} />
          </div>
        )}
      </SectionCard>

      {/* ══ 2. Contact & Community ══════════════════════════════════════════ */}
      <SectionCard title="Contact &amp; Community" onEdit={() => setEditing('contact')} editing={editing==='contact'}>
        {editing==='contact' ? (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16 }}>
              <div className="form-group"><label className="form-label">Phone Number</label>
                <input className="form-input" type="tel" value={f.phone} onChange={e=>set('phone',e.target.value)} placeholder="08012345678" /></div>
              <div className="form-group"><label className="form-label">State of Residence</label>
                <select className="form-select" value={f.state} onChange={e=>set('state',e.target.value)}>
                  <option value="">Select state</option>{NIGERIAN_STATES.map(s=><option key={s}>{s}</option>)}
                </select></div>
              <div className="form-group"><label className="form-label">Trade / Sector</label>
                <select className="form-select" value={f.trade} onChange={e=>set('trade',e.target.value)}>
                  <option value="">Select</option>{TRADES.map(t=><option key={t}>{t}</option>)}
                </select></div>
            </div>
            <div className="form-group" style={{ marginTop:4 }}>
              <label className="form-label">Physical Address <span style={{ color:'var(--text-muted)', fontWeight:400 }}>— appears on wallet statements</span></label>
              <input className="form-input" value={f.address} onChange={e=>set('address',e.target.value)} placeholder="12 Awka Road, Onitsha, Anambra" />
            </div>
            <SaveCancel label="Contact" fields={{ phone:f.phone, state:f.state, trade:f.trade, address:f.address }} />
          </>
        ) : (
          <div style={{ marginTop:4 }}>
            <Row label="Phone number"     value={member?.phone} />
            <Row label="Email"            value={member?.email} hint="Used to sign in" />
            <Row label="State"            value={member?.state} />
            <Row label="Trade / Sector"   value={member?.trade} />
            <Row label="Physical address" value={m?.address} hint="Appears on wallet statements" />
            <Row label="Chapter"          value={member?.chapter} />
            <Row label="Region"           value={member?.region} />
          </div>
        )}
      </SectionCard>

      {/* ══ 3. Identity Verification ════════════════════════════════════════ */}
      <SectionCard title="Identity Verification" subtitle="NIN and business Tax ID for KYC and compliance" onEdit={() => setEditing('identity')} editing={editing==='identity'}>
        {editing==='identity' ? (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16 }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">National Identification Number (NIN)</label>
                <input className="form-input" style={{ fontFamily:'var(--font-mono)' }} value={f.nin} onChange={e=>set('nin',e.target.value.replace(/\D/g,'').slice(0,11))} placeholder="12345678901" maxLength={11} />
                <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:4, display:'block' }}>11 digits — required for wallet & insurance KYC</span>
              </div>
              <div className="form-group">
                <label className="form-label">Business Name <span style={{ fontWeight:400, color:'var(--text-muted)' }}>(optional)</span></label>
                <input className="form-input" value={f.businessName} onChange={e=>set('businessName',e.target.value)} placeholder="Adaeze Enterprises" />
              </div>
              <div className="form-group">
                <label className="form-label">Position / Role <span style={{ fontWeight:400, color:'var(--text-muted)' }}>(optional)</span></label>
                <input className="form-input" value={f.position} onChange={e=>set('position',e.target.value)} placeholder="Director" />
              </div>
              {f.businessName && f.nationality === 'Nigeria' && (
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Business Tax ID <span style={{ color:'var(--ibi-red-light)' }}>*</span></label>
                  <input className="form-input" style={{ fontFamily:'var(--font-mono)' }} value={f.businessTaxId} onChange={e=>set('businessTaxId',e.target.value.toUpperCase())} placeholder="TXID1234ABCD001" />
                  <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:4, display:'block' }}>
                    Required for Nigerian businesses. Get yours free at{' '}
                    <a href="https://taxid.nrs.gov.ng" target="_blank" rel="noopener noreferrer" style={{ color:'var(--ibi-gold)' }}>taxid.nrs.gov.ng</a>
                  </span>
                </div>
              )}
            </div>
            <SaveCancel label="Identity" fields={{ nin:f.nin, businessName:f.businessName, position:f.position, businessTaxId:f.businessTaxId, nationality:f.nationality }} />
          </>
        ) : (
          <div style={{ marginTop:4 }}>
            <Row label="NIN" value={m?.nin ? `${'•'.repeat(7)}${m.nin.slice(-4)}` : undefined} hint="Masked for security" />
            <Row label="Business name"   value={m?.businessName} />
            <Row label="Position"        value={m?.position} />
            <Row label="Business Tax ID" value={m?.businessTaxId} hint={m?.businessName && m?.nationality === 'Nigeria' ? 'From taxid.nrs.gov.ng' : undefined} />
          </div>
        )}
      </SectionCard>

      {/* ══ 4. Next of Kin / Emergency Contact ══════════════════════════════ */}
      <SectionCard title="Next of Kin / Emergency Contact" subtitle="Appears on the back of your IBI ID card" onEdit={() => setEditing('nok')} editing={editing==='nok'}>
        {editing==='nok' ? (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16 }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Full Name</label>
                <input className="form-input" value={f.nokName} onChange={e=>set('nokName',e.target.value)} placeholder="Next of kin's full name" />
              </div>
              <div className="form-group">
                <label className="form-label">Relationship</label>
                <select className="form-select" value={f.nokRel} onChange={e=>set('nokRel',e.target.value)}>
                  <option value="">Select</option>{RELATIONSHIPS.map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-input" type="tel" value={f.nokPhone} onChange={e=>set('nokPhone',e.target.value)} placeholder="08012345678" />
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Email <span style={{ fontWeight:400, color:'var(--text-muted)' }}>(optional)</span></label>
                <input className="form-input" type="email" value={f.nokEmail} onChange={e=>set('nokEmail',e.target.value)} placeholder="email@example.com" />
              </div>
            </div>
            <SaveCancel label="Next of kin" fields={{ nextOfKin:{ name:f.nokName, relationship:f.nokRel, phone:f.nokPhone, email:f.nokEmail } }} />
          </>
        ) : (
          <div style={{ marginTop:4 }}>
            <Row label="Full name"     value={m?.nextOfKin?.name} />
            <Row label="Relationship"  value={m?.nextOfKin?.relationship} />
            <Row label="Phone number"  value={m?.nextOfKin?.phone} />
            <Row label="Email"         value={m?.nextOfKin?.email} />
          </div>
        )}
      </SectionCard>

      {/* ══ 5. Membership Details (read-only) ═══════════════════════════════ */}
      <SectionCard title="Membership Details">
        <div style={{ marginTop:4 }}>
          <Row label="IBI Number"   value={<code style={{ fontFamily:'var(--font-mono)', color:'var(--ibi-gold)' }}>{member?.ibiNumber ?? 'Pending'}</code>} />
          <Row label="Tier"         value={<span style={{ textTransform:'capitalize' }}>{member?.membershipTier}</span>} />
          <Row label="Member since" value={member?.joinedAt ? new Date(member.joinedAt).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) : undefined} />
          <Row label="Valid until"  value={member?.expiresAt ? new Date(member.expiresAt).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) : 'Lifetime'} />
        </div>
      </SectionCard>

      {/* ══ 6. Wallet, Insurance & Marketplace ══════════════════════════════ */}
      <SectionCard title="Wallet, Insurance &amp; Marketplace">
        <div style={{ marginTop:4 }}>
          <Row label="Wallet balance" value={<span style={{ color:'var(--ibi-gold)', fontWeight:700, fontFamily:'var(--font-mono)' }}>₦{(member?.walletBalance ?? 0).toLocaleString()}</span>} />
          <Row label="IBI Cards"      value="Verve · AfriGo · Visa · Mastercard" hint="Order or manage from the IBI Cards section" />
          <Row label="Insurance"      value={<span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>Coming soon — community health &amp; business</span>} />
          <Row label="Marketplace"    value={<span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>Coming soon — escrow-protected member trading</span>} />
        </div>
      </SectionCard>

      {/* Affiliate code */}
      {member?.affiliateCode && (
        <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'var(--space-lg)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, flexWrap:'wrap', marginBottom:'var(--space-md)' }}>
          <div>
            <div style={{ fontSize:'0.72rem', color:'var(--ibi-gold)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>Affiliate Code</div>
            <code style={{ fontFamily:'var(--font-mono)', fontSize:'1.1rem', color:'var(--text-primary)', fontWeight:700 }}>{member.affiliateCode}</code>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => { navigator.clipboard.writeText(`https://igbobuigbo.org.ng/membership?ref=${member.affiliateCode}`); toast.success('Affiliate link copied!'); }}>
            Copy Link
          </button>
        </div>
      )}

      <div style={{ textAlign:'center', padding:'var(--space-md)' }}>
        <button className="btn btn-ghost btn-sm" onClick={async () => {
          if (!auth) { toast.error('Not available right now — please try again shortly'); return; }
          const { sendPasswordResetEmail } = await import('firebase/auth');
          await sendPasswordResetEmail(auth, member?.email ?? '');
          toast.success('Password reset email sent to ' + member?.email);
        }}>Change Password</button>
      </div>

      <WalletPinSettings />
    </div>
  );
}

// Settings-page PIN management — the only place both PINs are visible and
// manageable together. A change made from the wallet page itself only ever
// touches whichever PIN was used to unlock that session (main or duress),
// deliberately never exposing here that a second PIN even exists to
// whoever is present when a wallet-page change happens.
function WalletPinSettings() {
  const [expanded, setExpanded] = useState<'change' | 'duress' | 'forgot' | null>(null);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState('');

  const reset = () => { setCurrentPin(''); setNewPin(''); setConfirmPin(''); setExpanded(null); setResetCodeSent(false); setResetCode(''); };

  const submitChange = async () => {
    if (!/^\d{4}$/.test(newPin)) { toast.error('New PIN must be 4 digits'); return; }
    if (newPin !== confirmPin)   { toast.error('PINs do not match'); return; }
    setBusy(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch('/api/wallet/pin/set', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body: JSON.stringify({ newPin, currentPin: currentPin || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Wallet PIN updated');
      reset();
    } catch (e: any) {
      toast.error(e.message ?? 'Could not update PIN');
    } finally { setBusy(false); }
  };

  const submitDuress = async () => {
    if (!/^\d{4}$/.test(newPin)) { toast.error('Duress PIN must be 4 digits'); return; }
    if (newPin !== confirmPin)   { toast.error('PINs do not match'); return; }
    if (!/^\d{4}$/.test(currentPin)) { toast.error('Enter your main PIN to confirm'); return; }
    setBusy(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch('/api/wallet/pin/set-duress', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body: JSON.stringify({ duressPin: newPin, mainPin: currentPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Duress PIN set');
      reset();
    } catch (e: any) {
      toast.error(e.message ?? 'Could not set duress PIN');
    } finally { setBusy(false); }
  };

  const requestResetCode = async () => {
    setBusy(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch('/api/wallet/pin/forgot', {
        method:'POST', headers:{ Authorization:`Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message ?? 'Code sent');
      setResetCodeSent(true);
    } catch (e: any) {
      toast.error(e.message ?? 'Could not send reset code');
    } finally { setBusy(false); }
  };

  const submitReset = async () => {
    if (!/^\d{6}$/.test(resetCode))  { toast.error('Enter the 6-digit code from your email'); return; }
    if (!/^\d{4}$/.test(newPin))     { toast.error('New PIN must be 4 digits'); return; }
    if (newPin !== confirmPin)       { toast.error('PINs do not match'); return; }
    setBusy(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch('/api/wallet/pin/reset', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body: JSON.stringify({ code: resetCode, newPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('PIN reset. You can now set up a new duress PIN too, if you had one.');
      reset();
    } catch (e: any) {
      toast.error(e.message ?? 'Could not reset PIN');
    } finally { setBusy(false); }
  };


  return (
    <div className="card" style={{ marginTop:'var(--space-lg)' }}>
      <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'var(--space-md)' }}>
        Wallet PIN & Security
      </div>

      {!expanded && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setExpanded('change')}>Change Wallet PIN</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setExpanded('duress')}>Set Up Duress PIN</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setExpanded('forgot')}>Forgot Your PIN?</button>
        </div>
      )}

      {expanded === 'change' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:280 }}>
          <p style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Leave "current PIN" blank if you've never set one yet.</p>
          <input type="password" inputMode="numeric" maxLength={4} className="form-input" placeholder="Current PIN (if any)" value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g,''))} />
          <input type="password" inputMode="numeric" maxLength={4} className="form-input" placeholder="New PIN" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,''))} />
          <input type="password" inputMode="numeric" maxLength={4} className="form-input" placeholder="Confirm new PIN" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g,''))} />
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Cancel</button>
            <button className="btn btn-gold btn-sm" onClick={submitChange} disabled={busy}>{busy ? 'Saving…' : 'Save PIN'}</button>
          </div>
        </div>
      )}

      {expanded === 'duress' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:320 }}>
          <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', lineHeight:1.6 }}>
            A duress PIN shows a reduced balance and strictly limits what can be sent if you're
            ever forced to unlock your wallet against your will. Requires your main PIN to set up.
          </p>
          <input type="password" inputMode="numeric" maxLength={4} className="form-input" placeholder="Your main PIN" value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g,''))} />
          <input type="password" inputMode="numeric" maxLength={4} className="form-input" placeholder="New duress PIN" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,''))} />
          <input type="password" inputMode="numeric" maxLength={4} className="form-input" placeholder="Confirm duress PIN" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g,''))} />
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Cancel</button>
            <button className="btn btn-gold btn-sm" onClick={submitDuress} disabled={busy}>{busy ? 'Saving…' : 'Set Duress PIN'}</button>
          </div>
        </div>
      )}

      {expanded === 'forgot' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:320 }}>
          {!resetCodeSent ? (
            <>
              <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', lineHeight:1.6 }}>
                We'll email a 6-digit code to your registered address. If you also had a
                duress PIN set, you'll need to set it up again after this, once you know
                your new main PIN.
              </p>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Cancel</button>
                <button className="btn btn-gold btn-sm" onClick={requestResetCode} disabled={busy}>{busy ? 'Sending…' : 'Email Me a Code'}</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Check your email for the 6-digit code — it expires in 10 minutes.</p>
              <input inputMode="numeric" maxLength={6} className="form-input" placeholder="6-digit code" value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g,''))} />
              <input type="password" inputMode="numeric" maxLength={4} className="form-input" placeholder="New PIN" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,''))} />
              <input type="password" inputMode="numeric" maxLength={4} className="form-input" placeholder="Confirm new PIN" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g,''))} />
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Cancel</button>
                <button className="btn btn-gold btn-sm" onClick={submitReset} disabled={busy}>{busy ? 'Resetting…' : 'Reset PIN'}</button>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={requestResetCode} disabled={busy} style={{ alignSelf:'flex-start', fontSize:'0.72rem' }}>Resend code</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
