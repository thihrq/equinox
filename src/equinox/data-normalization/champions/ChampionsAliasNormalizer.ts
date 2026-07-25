const ALIAS_MAP: Record<string, string> = {
  'raichu-x': 'raichu-mega-x',
  'raichu-y': 'raichu-mega-y',
  'mega-raichu-x': 'raichu-mega-x',
  'mega-raichu-y': 'raichu-mega-y',
  'mega-mawile': 'mawile-mega',
  'mawilemega': 'mawile-mega',
  'mega-metagross': 'metagross-mega',
};

export function normalizeChampionsId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return ALIAS_MAP[normalized] ?? normalized;
}

export function normalizeChampionsList(values: string[]): string[] {
  return [...new Set(values.map(normalizeChampionsId))].sort();
}
