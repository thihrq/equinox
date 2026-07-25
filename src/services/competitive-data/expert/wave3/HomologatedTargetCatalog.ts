// Wave 3 -- resolves the real, homologated 47-target catalog (6 Wave 1 sentinel targets + 41 Wave 2
// expansion targets) WITHOUT depending on any specific past run's artifact directory. Both halves
// are deterministic given only the static repo fixture and the current (unchanged) data pack, so
// this recomputes the identical 47 records that Wave 2's approved run produced, on demand, for any
// Wave 3 batch. Mission requirement: reuse the Wave 2 target catalog unmodified.
import fs from 'fs';
import crypto from 'crypto';
import { ChampionsCompetitivePackage, ChampionsPackageValidationResult } from '../../../../equinox/data-packs/champions/ChampionsPackageTypes';
import { expandTargetCatalog } from '../wave2/TargetCatalogExpansion';
import { CatalogTargetRecord } from '../wave2/CandidateScenarioEngine';

const PREVIOUS_TARGET_POKEMON_IDS = ['0003-000', '0006-000', '0009-000', '0015-000', '0018-000', '0024-000'];
const PREVIOUS_TARGET_SET_EVIDENCE_CATALOG = 'artifacts/competitive-finalization/targets/target-set-evidence-catalog.json';

const digest = (value: unknown): string => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

export function resolveHomologatedTargetCatalog(pkg: ChampionsCompetitivePackage, validation: ChampionsPackageValidationResult): { catalog: CatalogTargetRecord[]; targetCatalogDigest: string } {
  const previousCatalog = JSON.parse(fs.readFileSync(PREVIOUS_TARGET_SET_EVIDENCE_CATALOG, 'utf8')).records as CatalogTargetRecord[];
  const expansion = expandTargetCatalog({ pkg, validation, previousTargetPokemonIds: PREVIOUS_TARGET_POKEMON_IDS });
  const catalog: CatalogTargetRecord[] = [...previousCatalog, ...expansion.newTargets];
  return { catalog, targetCatalogDigest: digest(catalog.map(t => t.targetSetId).sort()) };
}
