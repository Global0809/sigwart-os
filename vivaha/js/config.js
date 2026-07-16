// ═══════════════════════════════════════════════════════════════════════════
// ANANTA — configuration
// Every guest-facing detail lives here. Edit this file only; the world
// rebuilds itself around whatever you write below.
// ═══════════════════════════════════════════════════════════════════════════

export const COUPLE = {
  bride: 'Diya',
  groom: 'Aarav',
  brideFull: 'Diya Sharma',
  groomFull: 'Aarav Malhotra',
  // shown beneath the names on the marble invitation
  blessing: 'with the blessings of Sharma & Malhotra families',
  hashtag: '#AaravKiDiya',
};

export const WEDDING = {
  dateLine: 'Saturday, the Twelfth of December, 2026',
  shortDate: '12 · 12 · 2026',
  muhurat: 'Pheras at 7:20 pm — Vrishchika Lagna',
  venue: 'Jag Niwas Palace',
  venueCity: 'Lake Pichola, Udaipur',
  mapsQuery: 'Taj Lake Palace, Udaipur',
  rsvpBy: 'the First of November, 2026',
  // where RSVPs are e-mailed (a pre-filled mail is composed; nothing is sent silently)
  rsvpEmail: 'rsvp@aaravkidiya.in',
};

export const EVENTS = [
  { name: 'Mehendi',   date: 'Thu, 10 Dec', time: '3:00 pm',  place: 'Lily Pond Courtyard', dress: 'Shades of green',        note: 'Henna, folk songs & saanjhi swings' },
  { name: 'Haldi',     date: 'Fri, 11 Dec', time: '10:00 am', place: 'Marigold Terrace',    dress: 'Yellows & whites',       note: 'Bring clothes you can turn golden' },
  { name: 'Sangeet',   date: 'Fri, 11 Dec', time: '7:30 pm',  place: 'Durbar Hall',         dress: 'Festive & fearless',     note: 'Two families, one dance floor' },
  { name: 'Vivaah',    date: 'Sat, 12 Dec', time: '6:00 pm',  place: 'Lake Pavilion',       dress: 'Traditional regal',      note: 'Baraat departs at 5 pm sharp' },
  { name: 'Reception', date: 'Sun, 13 Dec', time: '8:00 pm',  place: 'Moonlight Lawns',     dress: 'Black tie, Indian heart', note: 'Dinner under a thousand diyas' },
];

export const STAY = [
  { name: 'Jag Niwas Palace',      line: 'The venue itself — a palace afloat on Lake Pichola', code: 'Bridal block · code ANANTA' },
  { name: 'Amrai Ghat Haveli',     line: 'Seven minutes by boat, sunset-facing rooms',          code: 'Group code AKD-1212' },
  { name: 'The Leela, Udaipur',    line: 'For those who like their palaces with a spa',          code: 'Mention the wedding for shuttle' },
];

// Gallery — leave src empty ('') to show the hand-painted placeholder miniatures.
// Drop image files into vivaha/assets/ and reference them here to replace.
export const GALLERY = [
  { src: '', caption: 'How it began — Jaipur, 2021' },
  { src: '', caption: 'The yes, at 4 a.m.' },
  { src: '', caption: 'Two houses, one courtyard' },
  { src: '', caption: 'Monsoon, Marine Drive' },
  { src: '', caption: 'The ring & the rain' },
  { src: '', caption: 'Countdown to forever' },
];

// ── quality tiers ───────────────────────────────────────────────────────────
export const QUALITY = {
  high:   { particles: 110_000, dpr: 1.75, petals: 900, embers: 900, fireflies: 320, rays: true,  msaa: 4 },
  medium: { particles: 60_000,  dpr: 1.5,  petals: 520, embers: 520, fireflies: 200, rays: true,  msaa: 2 },
  low:    { particles: 26_000,  dpr: 1.0,  petals: 240, embers: 260, fireflies: 90,  rays: false, msaa: 0 },
};

// ── palette (hex) ───────────────────────────────────────────────────────────
export const PALETTE = {
  void:      0x050208,
  gold:      0xf2b23c,
  goldHot:   0xffd98a,
  goldDeep:  0x6a4413,
  ember:     0xff7a2f,
  ruby:      0xe0234f,
  marble:    0xf5ead8,
  duskRose:  0x3a1230,
  nightBlue: 0x0b0a1e,
  teal:      0x1e4d5c,
  moon:      0xfff3d9,
};
