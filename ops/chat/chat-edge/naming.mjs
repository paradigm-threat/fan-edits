/** Theater-house anon nick generation (no raw IP in nick). */

const HOUSES = [
  'Orpheum',
  'Rialto',
  'Bijou',
  'Palace',
  'Rex',
  'Strand',
  'Vista',
  'Cameo',
  'Regal',
  'Apollo',
  'Lux',
  'Marlowe',
  'Capitol',
  'Egyptian',
  'Paradise',
  'Astoria',
];

const COUNTRY_HOUSE = {
  US: 'Orpheum',
  CA: 'Rialto',
  GB: 'Palace',
  UK: 'Palace',
  IE: 'Strand',
  FR: 'Cameo',
  DE: 'Capitol',
  NL: 'Vista',
  BE: 'Lux',
  ES: 'Egyptian',
  IT: 'Apollo',
  PT: 'Paradise',
  BR: 'Astoria',
  MX: 'Regal',
  JP: 'Marlowe',
  KR: 'Rex',
  CN: 'Bijou',
  HK: 'Bijou',
  TW: 'Cameo',
  SG: 'Vista',
  AU: 'Strand',
  NZ: 'Strand',
  IN: 'Lux',
  SE: 'Apollo',
  NO: 'Apollo',
  FI: 'Apollo',
  PL: 'Capitol',
  UA: 'Capitol',
  RU: 'Palace',
  ZA: 'Egyptian',
  AR: 'Astoria',
  CL: 'Astoria',
};

const EDIT_VERBS = [
  'Trim',
  'Fade',
  'Cut',
  'Dissolve',
  'Wipe',
  'Match',
  'Ripple',
  'Splice',
  'Grade',
  'Dub',
];

const CITY_ADJ = [
  'Brooklyn',
  'Osaka',
  'Chicago',
  'Lisbon',
  'Seoul',
  'Austin',
  'Berlin',
  'Kyoto',
  'Miami',
  'Dublin',
  'Taipei',
  'Denver',
];

function fnv1a(str) {
  let h = 0x811c9dc5;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function sanitizeNick(raw) {
  let n = String(raw || '')
    .replace(/[^A-Za-z0-9_\-]/g, '')
    .slice(0, 24);
  if (n.length < 2) return '';
  if (/^[0-9]/.test(n)) n = 'N' + n;
  return n;
}

export function theaterNick({ country, ip, ua, mode } = {}) {
  const m = mode === 'cut-room' ? 'cut-room' : 'theater';
  const cc = String(country || '')
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const seed = `${String(ip || '').replace(/\.\d+$/, '.0')}|${String(ua || '').slice(0, 80)}|${cc}`;
  const h = fnv1a(seed);

  if (m === 'cut-room') {
    const adj = CITY_ADJ[h % CITY_ADJ.length];
    const verb = EDIT_VERBS[(h >>> 8) % EDIT_VERBS.length];
    return sanitizeNick(adj + verb) || 'LobbyCut';
  }

  const house = COUNTRY_HOUSE[cc] || HOUSES[h % HOUSES.length] || 'Lobby';
  const row = String.fromCharCode(65 + ((h >>> 4) % 26));
  const seat = String(1 + ((h >>> 12) % 24));
  return sanitizeNick(`${house}-${row}${seat}`) || 'Lobby-A1';
}

export function countryFromHeaders(headers) {
  const h = headers || {};
  const keys = [
    'cf-ipcountry',
    'x-geo-country',
    'x-country-code',
    'cloudfront-viewer-country',
  ];
  for (const k of keys) {
    const v = h[k] || h[k.toLowerCase()];
    if (v && String(v).length === 2 && String(v).toUpperCase() !== 'XX') {
      return String(v).toUpperCase();
    }
  }
  return '';
}

export { sanitizeNick, HOUSES };
