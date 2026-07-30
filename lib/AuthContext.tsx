// lib/AuthContext.tsx
'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User }           from 'firebase/auth';
import { doc, getDoc, onSnapshot }            from 'firebase/firestore';
import { auth, db }                           from './firebase';

export interface IBIMember {
  uid:            string;
  email:          string;
  displayName:    string;
  ibiNumber:      string;
  chapterCode:    string;
  chapter:        string;
  region:         string;
  membershipTier: string;
  status:         'pending' | 'active' | 'suspended';
  walletBalance:  number;
  affiliateCode:  string;
  photoURL?:      string;
  phone?:         string;
  address?:       string;
  state?:         string;
  trade?:         string;
  dob?:           string;
  joinedAt:       string;
  expiresAt?:     string;
  // ── Extended profile fields ──────────────────────────────────────────────
  gender?:        string;
  bloodType?:     string;
  nationality?:   string;
  businessName?:  string;
  position?:      string;
  /** National Identification Number — 11 digits */
  nin?:           string;
  /** Nigeria Tax ID from taxid.nrs.gov.ng — format TXID1234ABCD001 */
  businessTaxId?: string;
  /** Next of kin / emergency contact — shown on ID card back */
  nextOfKin?: {
    name:         string;
    relationship: string;
    phone:        string;
    email?:       string;
  };
}

interface AuthCtx {
  user:          User | null;
  member:        IBIMember | null;
  loading:       boolean;
  refreshMember: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, member: null, loading: true, refreshMember: async () => {},
});

function mapMember(uid: string, u: User, data: Record<string, any>): IBIMember {
  return {
    uid,
    email:          data.email          ?? u.email          ?? '',
    displayName:    data.displayName    ?? u.displayName    ?? '',
    ibiNumber:      data.ibiNumber      ?? '',
    chapterCode:    data.chapterCode    ?? '',
    chapter:        data.chapter        ?? '',
    region:         data.region         ?? '',
    membershipTier: data.membershipTier ?? 'associate',
    status:         data.status         ?? 'pending',
    walletBalance:  typeof data.walletBalance === 'number' ? data.walletBalance : 0,
    affiliateCode:  data.affiliateCode  ?? '',
    photoURL:       data.photoURL       ?? u.photoURL       ?? '',
    phone:          data.phone          ?? '',
    address:        data.address        ?? '',
    state:          data.state          ?? '',
    trade:          data.trade          ?? '',
    dob:            data.dob            ?? '',
    joinedAt:       data.joinedAt       ?? new Date().toISOString(),
    expiresAt:      data.expiresAt      ?? '',
    // Extended fields
    gender:         data.gender         ?? '',
    bloodType:      data.bloodType      ?? '',
    nationality:    data.nationality    ?? 'Nigeria',
    businessName:   data.businessName   ?? '',
    position:       data.position       ?? '',
    nin:            data.nin            ?? '',
    businessTaxId:  data.businessTaxId  ?? '',
    nextOfKin:      data.nextOfKin      ?? undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [member,  setMember]  = useState<IBIMember | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMember = async () => {
    if (!user || !db) return;
    try {
      const snap = await getDoc(doc(db, 'members', user.uid));
      if (snap.exists()) setMember(mapMember(user.uid, user, snap.data()));
    } catch (e) {
      console.error('[AuthContext] refreshMember failed:', e);
    }
  };

  useEffect(() => {
    if (!auth || !db) { setLoading(false); return; }

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && db) {
        const unsubSnap = onSnapshot(
          doc(db, 'members', u.uid),
          (snap) => {
            if (snap.exists()) setMember(mapMember(u.uid, u, snap.data()));
            setLoading(false);
          },
          (err) => {
            console.error('[AuthContext] onSnapshot error:', err.code, err.message);
            if (err.code === 'permission-denied')
              console.error('[AuthContext] Run: firebase deploy --only firestore:rules');
            setLoading(false);
          },
        );
        return () => unsubSnap();
      } else {
        setMember(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, member, loading, refreshMember }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
