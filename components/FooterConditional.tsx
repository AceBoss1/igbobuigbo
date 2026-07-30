// components/FooterConditional.tsx
'use client';
import { usePathname } from 'next/navigation';
import Footer          from '@/components/Footer';

const HIDE_ON = ['/dashboard', '/admin'];

export default function FooterConditional() {
  const pathname = usePathname();
  if (HIDE_ON.some(prefix => pathname.startsWith(prefix))) return null;
  return <Footer />;
}
