// components/NavbarConditional.tsx
// Client component — usePathname() lets us hide the public navbar
// on all /dashboard and /admin routes without restructuring the app.
'use client';
import { usePathname } from 'next/navigation';
import Navbar          from '@/components/Navbar';

const HIDE_ON = ['/dashboard', '/admin'];

export default function NavbarConditional() {
  const pathname = usePathname();
  if (HIDE_ON.some(prefix => pathname.startsWith(prefix))) return null;
  return <Navbar />;
}
