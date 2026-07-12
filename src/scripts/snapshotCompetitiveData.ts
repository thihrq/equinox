import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import setsDataPack from '../equinox/data-packs/sets-data-pack.json';
import { DataPackRegistry } from '../equinox/data-packs/DataPackRegistry';
import { detectCompetitiveSetDuplicates } from '../equinox/data-audit/CompetitiveSetDuplicateDetector';

interface LegacySet {
  pokemonName: string;
  formatId: string;
  setName?: string;
  item?: string;
  ability?: string;
  nature?: string;
  evs?: Record<string, number | undefined>;
  moves?: string[];
  role?: string;
}

const sets = setsDataPack.sets as unknown as LegacySet[];
const manifests = new DataPackRegistry().buildReport();
const byFormat = countBy(sets.map(set => set.formatId));
const duplicateCandidates = detectCompetitiveSetDuplicates(sets.map((set, index) => ({
  setId: `${set.formatId}:${set.pokemonName}:${index}`,
  pokemonId: set.pokemonName,
  formId: set.pokemonName,
  regulationId: set.formatId,
  item: set.item ?? '',
  ability: set.ability ?? '',
  nature: set.nature ?? '',
  evs: set.evs,
  ivs: {},
  moves: set.moves ?? [],
  sourceId: 'equinox-legacy-sets-pack',
  primaryRole: set.role,
})));

const snapshot = {
  generatedAt: new Date().toISOString(),
  pokemonCount: new Set(sets.map(set => set.pokemonName)).size,
  setCount: sets.length,
  setsByFormat: byFormat,
  setsWithoutFourMoves: sets.filter(set => (set.moves ?? []).length !== 4).map(set => `${set.formatId}:${set.pokemonName}:${set.setName ?? 'set'}`),
  setsWithoutCompleteEvs: sets.filter(set => !set.evs || ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].some(stat => typeof set.evs?.[stat] !== 'number')),
  ambiguousNatures: sets.filter(set => String(set.nature ?? '').includes('/')).map(set => `${set.formatId}:${set.pokemonName}:${set.nature}`),
  duplicateCandidates,
  unknownRoles: [...new Set(sets.map(set => set.role).filter(role => !role))],
  unknownForms: sets.filter(set => !set.pokemonName).map(set => set.setName ?? 'unknown'),
  natures: countBy(sets.map(set => set.nature ?? 'unknown')),
  roles: countBy(sets.map(set => set.role ?? 'unknown')),
  packageVersion: setsDataPack.version,
  manifestStatus: manifests.overallStatus,
  manifestConfidence: manifests.confidence,
  manifests: manifests.manifests.map(manifest => ({
    id: manifest.id,
    kind: manifest.kind,
    status: manifest.status,
    recordCount: manifest.recordCount,
    dataVersion: manifest.dataVersion,
  })),
  fileHashes: {
    setsDataPack: sha256(readFileSync(join(process.cwd(), 'src/equinox/data-packs/sets-data-pack.json'))),
  },
};

mkdirSync(join(process.cwd(), 'data-audit/snapshots'), { recursive: true });
writeFileSync(
  join(process.cwd(), 'data-audit/snapshots/2026-07-current-state.json'),
  `${JSON.stringify(snapshot, null, 2)}\n`,
);

console.log(`[Equinox] Snapshot generated: sets=${snapshot.setCount} pokemon=${snapshot.pokemonCount}`);

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function sha256(content: Buffer): string {
  const value = content.toString('utf8');
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}
