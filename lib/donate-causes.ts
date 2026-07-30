// lib/donate-causes.ts
// Shared between app/donate/page.tsx (public, no login required) and
// components/dashboard/DonateModal.tsx (logged-in members, in-dashboard).
// Keep cause list and preset amounts in one place so the two surfaces
// never drift out of sync.

export const CAUSES = [
  { id: 'general',     label: 'General Fund',      desc: 'Support IBI operations and programs', icon: '🏛️' },
  { id: 'scholarship', label: 'IBI Scholarship',   desc: 'Fund education for Igbo youth',        icon: '🎓' },
  { id: 'empowerment', label: 'Women Empowerment', desc: 'Support Igbo women in business',       icon: '👩‍💼' },
  { id: 'tech',        label: 'IBI Tech Hub',      desc: 'Build our digital infrastructure',     icon: '💻' },
  { id: 'disaster',    label: 'Disaster Relief',   desc: 'Aid Igbo communities in crisis',       icon: '🆘' },
];

export const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 25000, 50000];

export const MIN_DONATION_NAIRA = 100;
