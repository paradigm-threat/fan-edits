/**
 * Anon nick generation for mesh chat.
 * Picks from a curated Paradigm Threat / pop / researcher lexicon (no raw IP in nick).
 */

/** IRC-safe display names (letter start, ≤24 after sanitize). */
const PT_NICKS = [
  // Pop + Saturnian / Earthbound
  'MrSaturn',
  'SaturnValley',
  'BuzzBuzz',
  'GiygasEcho',
  'PokeyMinch',
  'Magicant',
  'ManiMani',
  'StarmanDX',
  'HappyHappy',
  'DeepDarkness',
  'PolarMountain',
  'KronosKing',
  'KaiwanStar',
  'GoldenAge',
  'AsherahTree',
  'BaalSplit',
  'IblisScar',
  // Predictive programming / fiction
  'Marvin',
  'Steppenwolf',
  'MagicTheater',
  'WareLit',
  'InTheHead',
  'CombineWatch',
  'GmanBrief',
  'GordonFree',
  'AlyxContain',
  'Epistle3',
  'ChildrenOfMen',
  'ArkOfArts',
  'QuietusDose',
  'Gutterballs',
  'MoHGlitch',
  'JenovaScar',
  'MidgarSpine',
  'VersionB',
  'AerisSpell',
  'Lifestream',
  'ShinraCorp',
  'ZackDelusion',
  'TonyStarkish',
  'ThanosCull',
  'IronManPlan',
  // Researchers / investigators named in corpus
  'Juergens',
  'Thornhill',
  'Talbott',
  'Cardona',
  'Velikovsky',
  'Sitchin',
  'Cochrane',
  'HanyokLeak',
  'GageWatch',
  'CorbettLane',
  'AssangeVault',
  'SnowdenLeak',
  // Event / agency flavor
  'Insider911',
  'NSA-Ally',
  'CIA-Skeptic',
  'Building7',
  'FalseFlagDay',
  'Oct7Stage',
  'VegasHotspot',
  'GulfOfTonkin',
  'PentagonPaper',
  'TitanicBox',
  'AstorPrize',
  'StrausLived',
  'HughesClass',
  'FedReset',
  'Mudflood',
  'TartariaMap',
  'HollowEarth',
  'MarsRV',
  'FaceOnMars',
  'CydoniaScan',
  'RemoteViewer',
  'CERNPortal',
  'XenGate',
  'QTrance',
  'FlatTrance',
  'ControlledOpp',
  'PredictiveProg',
  'DeepStateMap',
  'NixonGrounded',
  'TrumpCleanup',
  'ReaganPuppet',
  'PresDecouple',
  'Neonational',
  'SinEater',
  'JungPsyche',
  'HesseScan',
  'AUWitness',
  'RedactionGap',
  'TimelineFix',
  'ParadigmTip',
  'RelayGuest',
  'LobbySkeptic',
  'CorpusReader',
  'OpenInquiry',
  'DocVerified',
  'AuthorNote',
  'KeywordHunt',
  'SubstackBan',
  'PerpWalkCO',
  'AntibodyPlan',
  'Containment',
  'Disclosure',
  'ReadingRoom',
  'FOIADump',
  'DeclassWave',
  'CampNSA',
  'CampCIA',
  'AllianceMark',
  'OccultIcon',
  'VikingAsgard',
  'AtlantisHost',
  'MartianFork',
  'Earthling',
  'HeartChamber',
  'BreedingSign',
  'HonestAtheist',
  'SaturnSatan',
  'CreatorSplit',
  'GodIsAWoman',
  'LoveVsFear',
  'DarkAgeLock',
  'SolarInterlude',
];

/** Fan-edit / cut-room flavored picks (still PT-adjacent). */
const CUT_ROOM_NICKS = [
  'TrimReel',
  'FadeCut',
  'SpliceBay',
  'GradeBooth',
  'DubStage',
  'MatchFrame',
  'WipeLane',
  'RippleEdit',
  'DissolveIn',
  'CutRoom',
  'LobbyCut',
  'FanEditDesk',
  'NowShowing',
  'ReelSkeptic',
  'FrameWatch',
  'AspectFix',
  'SubtitleSpy',
  'DirectorCut',
  'AssemblyCut',
  'Workprint',
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

/**
 * Stable anon nick from IP/UA/country seed — curated lexicon, never embeds raw IP.
 * @param {{ country?: string, ip?: string, ua?: string, mode?: string }} opts
 */
export function theaterNick({ country, ip, ua, mode } = {}) {
  const m = mode === 'cut-room' ? 'cut-room' : 'theater';
  const cc = String(country || '')
    .trim()
    .toUpperCase()
    .slice(0, 2);
  // Coarse IP (drop last octet) so DHCP churn doesn't rotate the nick every lease.
  const seed = `${String(ip || '').replace(/\.\d+$/, '.0')}|${String(ua || '').slice(0, 80)}|${cc}|${m}`;
  const h = fnv1a(seed);
  const pool = m === 'cut-room' ? CUT_ROOM_NICKS : PT_NICKS;
  const pick = pool[h % pool.length] || pool[0] || 'RelayGuest';
  return sanitizeNick(pick) || 'RelayGuest';
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

export { sanitizeNick, PT_NICKS, CUT_ROOM_NICKS };
