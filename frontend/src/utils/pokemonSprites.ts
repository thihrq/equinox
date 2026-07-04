const SHOWDOWN_GEN5_BASE_URL = 'https://play.pokemonshowdown.com/sprites/gen5';

export const LOCAL_SPRITE_FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Pokémon sprite unavailable">
      <rect width="96" height="96" rx="22" fill="#0b0f12"/>
      <circle cx="48" cy="48" r="28" fill="#f5f3ee" opacity="0.95"/>
      <path d="M20 48h56" stroke="#111" stroke-width="7" stroke-linecap="round"/>
      <circle cx="48" cy="48" r="10" fill="#111"/>
      <circle cx="48" cy="48" r="5" fill="#f5f3ee"/>
    </svg>
  `);

const DIRECT_SPRITE_ALIASES: Record<string, string[]> = {
  // Battle Bond / Ash-Greninja variants used by different sources.
  greninjabond: ['greninjaash', 'greninja-ash', 'greninjabond', 'greninja-bond'],
  greninjabattlebond: ['greninjaash', 'greninja-ash', 'greninjabattlebond', 'greninja-battle-bond'],
  greninjaash: ['greninjaash', 'greninja-ash'],

  // Common punctuation / gender / spacing edge cases.
  nidoranf: ['nidoranf', 'nidoran-f'],
  nidoranm: ['nidoranm', 'nidoran-m'],
  mrmime: ['mrmime', 'mr-mime'],
  mrrime: ['mrrime', 'mr-rime'],
  mimejr: ['mimejr', 'mime-jr'],
  farfetchd: ['farfetchd', 'farfetch-d'],
  sirfetchd: ['sirfetchd', 'sirfetch-d'],
  typenull: ['typenull', 'type-null'],
  hooh: ['hooh', 'ho-oh'],
  porygonz: ['porygonz', 'porygon-z'],

  // Frequently renamed / aliased forme labels.
  ogerponwellspring: ['ogerponwellspring', 'ogerpon-wellspring'],
  ogerponhearthflame: ['ogerponhearthflame', 'ogerpon-hearthflame'],
  ogerponcornerstone: ['ogerponcornerstone', 'ogerpon-cornerstone'],
  ogerponteal: ['ogerpon', 'ogerponteal', 'ogerpon-teal'],
  palafinizen: ['palafin', 'palafinzero', 'palafin-zero'],
  palafinhero: ['palafinhero', 'palafin-hero'],
  basculegionf: ['basculegionf', 'basculegion-f'],
  indeedeeindeedeef: ['indeedeef', 'indeedee-f'],
  indeedeef: ['indeedeef', 'indeedee-f'],
  indeedee: ['indeedee'],
};

const FORM_SUFFIXES = [
  'mega-x',
  'mega-y',
  'mega',
  'alola',
  'galar',
  'hisui',
  'paldea',
  'origin',
  'origin-palkia',
  'origin-dialga',
  'therian',
  'incarnate',
  'sky',
  'land',
  'wash',
  'heat',
  'frost',
  'fan',
  'mow',
  'white',
  'black',
  'black-white',
  'resolute',
  'ordinary',
  'blade',
  'shield',
  'school',
  'solo',
  'amped',
  'low-key',
  'hangry',
  'full-belly',
  'sunshine',
  'midday',
  'midnight',
  'dusk',
  'dawn-wings',
  'dusk-mane',
  'ultra',
  'complete',
  '10',
  '50',
  'eternamax',
];

function normalizeInputName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[♀]/g, 'f')
    .replace(/[♂]/g, 'm')
    .replace(/[.]/g, '')
    .replace(/\s+/g, '-')
    .replace(/_+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function toPokemonShowdownId(name: string): string {
  return normalizeInputName(name).replace(/[^a-z0-9]/g, '');
}

function toSpriteUrl(spriteId: string): string {
  return `${SHOWDOWN_GEN5_BASE_URL}/${spriteId}.png`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function splitRecognizedForm(normalized: string): { base: string; suffix: string } | null {
  for (const suffix of FORM_SUFFIXES) {
    const token = `-${suffix}`;
    if (normalized.endsWith(token)) {
      return {
        base: normalized.slice(0, -token.length),
        suffix,
      };
    }
  }

  return null;
}

function getCandidateSpriteIds(name: string): string[] {
  const normalized = normalizeInputName(name);
  const showdownId = toPokemonShowdownId(name);
  const candidates: string[] = [];

  candidates.push(...(DIRECT_SPRITE_ALIASES[showdownId] ?? []));

  const form = splitRecognizedForm(normalized);

  if (form) {
    const baseId = form.base.replace(/[^a-z0-9]/g, '');
    const suffixId = form.suffix.replace(/[^a-z0-9]/g, '');

    // Pokémon Showdown assets are not fully consistent across folders and formes.
    // Try the most common ids first, then graceful fallbacks.
    candidates.push(`${baseId}${suffixId}`);
    candidates.push(`${form.base}-${form.suffix}`);

    if (form.suffix === 'mega') {
      candidates.push(`${form.base}-mega`);
    }

    if (form.suffix === 'mega-x' || form.suffix === 'mega-y') {
      candidates.push(`${baseId}${suffixId}`);
      candidates.push(`${form.base}-${form.suffix}`);
    }

    candidates.push(baseId);
    candidates.push(form.base);
  }

  candidates.push(showdownId);
  candidates.push(normalized);
  candidates.push(normalized.replace(/-/g, ''));

  return unique(candidates);
}

export function getPokemonSpriteCandidates(name: string): string[] {
  if (!name?.trim()) return [];

  return getCandidateSpriteIds(name).map(toSpriteUrl);
}

export function getPokemonSpriteUrl(name: string): string | null {
  return getPokemonSpriteCandidates(name)[0] ?? null;
}

export function getNextPokemonSpriteUrl(name: string, currentSrc: string): string {
  const candidates = getPokemonSpriteCandidates(name);

  const currentIndex = candidates.findIndex(candidate => {
    return currentSrc === candidate || currentSrc.endsWith(candidate.replace(SHOWDOWN_GEN5_BASE_URL, ''));
  });

  if (currentIndex >= 0 && currentIndex + 1 < candidates.length) {
    return candidates[currentIndex + 1];
  }

  if (currentIndex === -1 && candidates.length > 0) {
    return candidates[0];
  }

  return LOCAL_SPRITE_FALLBACK;
}

export function getSmogonPokemonSlug(name: string): string {
  const normalized = normalizeInputName(name);
  const showdownId = toPokemonShowdownId(name);

  if (DIRECT_SPRITE_ALIASES[showdownId]?.includes('greninjaash')) {
    return 'greninja';
  }

  const form = splitRecognizedForm(normalized);
  if (form) {
    return form.base;
  }

  return normalized;
}
