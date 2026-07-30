// lib/chapters-data.ts
// Single source of truth for all IBI chapters, regions, and zones.
// Used by: membership form, chapters page, transfer portal, and seed script.

export const REGIONS = [
  { id: 'ig', code: 'R1', label: 'Region 1 — Igbo Speaking States',       tagline: 'Core Igbo Homeland — South-East & South-South', color: '#C8102E', chapters: 7  },
  { id: 'ni', code: 'R2', label: 'Region 2 — Non-Igbo States & FCT',      tagline: 'Igbo Diaspora Within Nigeria — 30 Chapters',     color: '#D4AF37', chapters: 30 },
  { id: 'di', code: 'R3', label: 'Region 3 — Global Diaspora',            tagline: 'Igbo People Across 5 Continents',                color: '#6b7280', chapters: 6  },
] as const;

export type RegionId = 'ig' | 'ni' | 'di';

// ── Region 1: Igbo Speaking States ──────────────────────────────────────────
export const IGBO_STATES = {
  zoneName: 'Region 1 — Igbo Speaking States',
  zones: [
    {
      label: 'South-East States (5 Core Igbo States)',
      chapters: ['Abia State','Anambra State','Ebonyi State','Enugu State','Imo State'],
    },
    {
      label: 'South-South States (Significant Igbo Communities)',
      chapters: ['Delta State','Rivers State'],
    },
  ],
};

// ── Region 2: Non-Igbo States & FCT ─────────────────────────────────────────
export const NON_IGBO_STATES = {
  zoneName: 'Region 2 — Non-Igbo States & FCT',
  zones: [
    { label: 'Federal Capital Territory', chapters: ['FCT Abuja'] },
    { label: 'South-South',  chapters: ['Akwa Ibom','Bayelsa State','Cross River','Edo State'] },
    { label: 'South-West',   chapters: ['Ekiti State','Lagos State','Ogun State','Ondo State','Osun State','Oyo State'] },
    { label: 'North-Central',chapters: ['Benue State','Kogi State','Kwara State','Nasarawa State','Niger State','Plateau State'] },
    { label: 'North-East',   chapters: ['Adamawa State','Bauchi State','Borno State','Gombe State','Taraba State','Yobe State'] },
    { label: 'North-West',   chapters: ['Jigawa State','Kaduna State','Kano State','Katsina State','Kebbi State','Sokoto State','Zamfara State'] },
  ],
};

// ── Region 3: Global Diaspora ────────────────────────────────────────────────
export const DIASPORA = {
  zoneName: 'Region 3 — Global Diaspora',
  continents: [
    { emoji:'🌍', label:'African Chapter',          sub:'Igbo across Africa',        countries:['South Africa','Ghana','Kenya','Cameroon','Ivory Coast','Other African Countries'] },
    { emoji:'🌍', label:'Europe Chapter',           sub:'Igbo across Europe',        countries:['United Kingdom','Germany','France','Italy','Netherlands','Other European Countries'] },
    { emoji:'🌎', label:'US / North America Chapter', sub:'Igbo in the Americas',   countries:['United States','Canada'] },
    { emoji:'🌏', label:'Asian Chapter',            sub:'Igbo in Asia & Middle East',countries:['UAE & Middle East','Malaysia','Other Asian Countries'] },
    { emoji:'🌏', label:'Australia & Oceania Chapter', sub:'',                       countries:['Australia & Oceania'] },
    { emoji:'🌐', label:'General Diaspora Chapter', sub:'All other countries',       countries:['Register Your Country','Propose a New Chapter'] },
  ],
};

// ── Flat list for selects ─────────────────────────────────────────────────────
export function getAllChapters(): { value: string; label: string; region: RegionId }[] {
  const out: { value: string; label: string; region: RegionId }[] = [];
  IGBO_STATES.zones.forEach(z => z.chapters.forEach(c => out.push({ value: c, label: `${c} Chapter`, region: 'ig' })));
  NON_IGBO_STATES.zones.forEach(z => z.chapters.forEach(c => out.push({ value: c, label: `${c} Chapter`, region: 'ni' })));
  DIASPORA.continents.forEach(cont =>
    cont.countries
      .filter(c => !c.startsWith('Register') && !c.startsWith('Propose'))
      .forEach(c => out.push({ value: c, label: c, region: 'di' }))
  );
  return out;
}

export function getChaptersByRegion(regionId: RegionId) {
  return getAllChapters().filter(c => c.region === regionId);
}

// ── Region wallet code ────────────────────────────────────────────────────────
// Distinct from REGIONS[].code (R1/R2/R3, used in UI labels) — this is
// specifically the 3-letter code used in regional purse wallet addresses,
// e.g. ISS/0000000001. See lib/orgWallets.ts.
export function regionWalletCode(regionId: RegionId): 'ISS' | 'NIS' | 'GDS' {
  return regionId === 'ig' ? 'ISS' : regionId === 'ni' ? 'NIS' : 'GDS';
}
// Returns 2-3 letter code from chapter name e.g. "Lagos State" → "LAG"
export function chapterCode(name: string): string {
  const overrides: Record<string, string> = {
    'FCT Abuja': 'FCT', 'Akwa Ibom': 'AKI', 'Cross River': 'CRS',
    'United Kingdom': 'GBR', 'United States': 'USA', 'South Africa': 'ZAF',
    'UAE & Middle East': 'UAE', 'Australia & Oceania': 'AUS',
  };
  // Strip a trailing " Chapter" first, then check overrides BEFORE
  // stripping " State" — and when stripping " State", anchor to the end
  // of the string ($) so it only matches a real trailing "State" suffix,
  // not the substring " State" that also appears inside plural "States"
  // (e.g. "United States" was corrupting into "Uniteds" via a plain
  // .replace(' State','') before this fix, missing the USA override
  // entirely and falling through to a meaningless 3-letter slice).
  let clean = name.replace(/ Chapter$/, '').trim();
  if (overrides[clean]) return overrides[clean];
  clean = clean.replace(/ State$/, '').trim();
  return overrides[clean] ?? clean.slice(0, 3).toUpperCase();
}
