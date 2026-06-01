// lib/AuthContext.tsx
'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface IBIMember {
  uid: string;
  email: string;
  displayName: string;
  ibiNumber: string;          // e.g. LAG/3847291056
  chapterCode: string;
  membershipTier: 'associate' | 'full' | 'premium' | 'lifetime';
  status: 'pending' | 'active' | 'suspended';
  walletBalance: number;
  affiliateCode: string;
  photoURL?: string;
  phone?: string;
  state?: string;
  trade?: string;
  joinedAt: string;
  expiresAt?: string;
}

interface AuthCtx {
  user: User | null;
  member: IBIMember | null;
  loading: boolean;
  refreshMember: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  member: null,
  loading: true,
  refreshMember: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<IBIMember | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMember = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'members', uid));
      if (snap.exists()) setMember({ uid, ...snap.data() } as IBIMember);
    } catch (e) {
      console.error('Failed to fetch member:', e);
    }
  };

  const refreshMember = async () => {
    if (user) await fetchMember(user.uid);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await fetchMember(u.uid);
      else setMember(null);
      setLoading(false);
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
