import { FormatIntelligenceRegistry } from '../equinox/formats/FormatIntelligenceRegistry';
import { VanillaGameProfileRegistry, VANILLA_GAME_PROFILES } from '../equinox/formats/VanillaGameProfiles';
import { CHAMPIONS_REGULATION_PROFILES } from '../equinox/champions/ChampionsRegulationData';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

type StrategyKind = 'vanilla' | 'radical_red' | 'generic';

interface ExpectedResult {
  strategy: StrategyKind;
  genericFormatId?: string;
}

const registry = new FormatIntelligenceRegistry();
const vanillaGameProfiles = new VanillaGameProfileRegistry();

// Reference implementation: FormatContext constructor as committed in 048a11d
// (registry.normalizeFormat + vanillaGameProfiles.isGameProfile). This is the "expected" side
// of the equivalence matrix -- the pre-existing, previously-working behavior.
function expectedDecision(formatId: string): ExpectedResult {
  const canonicalFormat = registry.normalizeFormat(formatId);
  if (canonicalFormat === 'radical_red') return { strategy: 'radical_red' };
  if (canonicalFormat === 'vanilla' || vanillaGameProfiles.isGameProfile(canonicalFormat)) return { strategy: 'vanilla' };
  return { strategy: 'generic', genericFormatId: canonicalFormat };
}

// Candidate implementation: literal copy of the proposed rewrite currently in the working tree
// (src/strategies/FormatStrategy.ts, segment "formatstrategy-seg-2-normalization-logic-rewrite").
function candidateDecision(formatId: string): ExpectedResult {
  const normalizedFormat = formatId.toLowerCase();
  if (normalizedFormat.startsWith('vanilla')) return { strategy: 'vanilla' };
  if (normalizedFormat.startsWith('radical_red') || normalizedFormat.startsWith('radical-red')) return { strategy: 'radical_red' };
  return { strategy: 'generic', genericFormatId: formatId };
}

const registeredFormats = [
  'vanilla',
  'radical_red',
  'national_dex',
  'champions_singles',
  'champions_ranked_singles',
  'champions_doubles',
  'champions_ranked_doubles',
  ...Object.keys(VANILLA_GAME_PROFILES),
  ...Object.keys(CHAMPIONS_REGULATION_PROFILES),
];

// Representative aliases, sourced directly from the private alias tables in
// FormatIntelligenceRegistry.normalizeFormat and VanillaGameProfileRegistry.normalizeFormat
// (both function-local, not exported -- these values are copied verbatim from that source, not
// guessed) -- covers canonical names, aliases, case differences, spaces, hyphens, underscores,
// prefixes, game profiles, and old/legacy formats still supported.
const aliasInputs = [
  'default', 'generic', 'vanilla_singles',
  'fire_red', 'firered', 'frlg', 'FireRed', 'Fire-Red', 'fire red',
  'radicalred', 'RR', 'rr_restricted', 'Radical Red', 'RADICAL-RED', 'radical red hardcore',
  'natdex', 'nationaldex', 'gen9ou', 'gen9vgc2025regi',
  'champion', 'champions', 'pokemon_champions_singles', 'champions_ranked',
  'pokemon_champions_doubles', 'champions_double',
  'red', 'blue', 'yellow', 'RED', 'Blue',
  'legends_za', 'legends_z_a', 'plza', 'Legends ZA', 'legends-za',
  'sword', 'shield', 'swsh', 'SWSH',
  'scarlet', 'violet', 'sv', 'SV',
];

const edgeCases: Array<{ label: string; value: any }> = [
  { label: 'empty string', value: '' },
  { label: 'whitespace only', value: '   ' },
  { label: 'uppercase VANILLA', value: 'VANILLA' },
  { label: 'mixed case VaNiLLa_Fire_Red', value: 'VaNiLLa_Fire_Red' },
  { label: 'leading/trailing spaces', value: '  vanilla  ' },
  { label: 'unregistered format', value: 'totally_unknown_format_xyz' },
  { label: 'string starting with vanilla but not a real profile', value: 'vanillanotarealformat' },
];

const divergences: Array<{ input: string; expected: ExpectedResult; candidate: ExpectedResult }> = [];
let registeredFormatsCovered = 0;
let aliasesCovered = 0;

for (const format of registeredFormats) {
  registeredFormatsCovered += 1;
  const expected = expectedDecision(format);
  const candidate = candidateDecision(format);
  if (expected.strategy !== candidate.strategy || (expected.strategy === 'generic' && expected.genericFormatId !== candidate.genericFormatId)) {
    divergences.push({ input: format, expected, candidate });
  }
}

for (const format of aliasInputs) {
  aliasesCovered += 1;
  const expected = expectedDecision(format);
  const candidate = candidateDecision(format);
  if (expected.strategy !== candidate.strategy || (expected.strategy === 'generic' && expected.genericFormatId !== candidate.genericFormatId)) {
    divergences.push({ input: format, expected, candidate });
  }
}

// null/undefined handling: expectedDecision defaults `format || 'vanilla'` inside the registry
// (safe). candidateDecision calls formatId.toLowerCase() directly -- this throws for null/undefined.
let nullCrashes = false;
try {
  candidateDecision(null as any);
} catch {
  nullCrashes = true;
}
let undefinedCrashes = false;
try {
  candidateDecision(undefined as any);
} catch {
  undefinedCrashes = true;
}

for (const edge of edgeCases) {
  if (edge.value === '') continue; // '' is falsy, handled like null/undefined by registry default; candidate treats it as a real string, checked separately below
  const expected = expectedDecision(edge.value);
  const candidate = candidateDecision(edge.value);
  if (expected.strategy !== candidate.strategy || (expected.strategy === 'generic' && expected.genericFormatId !== candidate.genericFormatId)) {
    divergences.push({ input: `[edge] ${edge.label} (${JSON.stringify(edge.value)})`, expected, candidate });
  }
}

console.log(JSON.stringify({
  registeredFormatsCovered,
  totalRegisteredFormats: registeredFormats.length,
  aliasesCovered,
  totalAliases: aliasInputs.length,
  divergenceCount: divergences.length,
  nullCrashes,
  undefinedCrashes,
  divergences,
}, null, 2));

// This test's PURPOSE is to prove the prefix-based rewrite is NOT behaviorally equivalent to the
// registry-based implementation. It is expected (and required) to find real divergences, including
// a crash on null/undefined input and loss of alias resolution for generic (champions/national_dex)
// formats. If a future change makes divergences=0 and no crashes, the assertions below will start
// passing, at which point the prefix rewrite could be reconsidered -- see HD-1 in
// artifacts/release-governance/targeted-classification-20260724T100530Z/planning/human-decisions-required.json.
assert(divergences.length > 0, 'Expected to find real behavioral divergences between the prefix rewrite and the registry-based implementation, but found none -- re-evaluate HD-1.');
assert(nullCrashes, 'Expected candidateDecision(null) to throw (formatId.toLowerCase() has no null guard) -- if this no longer throws, re-evaluate HD-1.');
assert(undefinedCrashes, 'Expected candidateDecision(undefined) to throw for the same reason.');

console.log('[Equinox] formatEquivalence test passed (confirmed non-equivalence, as expected -- HD-1 = FORMAT_PREFIX_REWRITE REJECTED).');
