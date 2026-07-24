import { ChampionsCompetitivePackage } from '../../data-packs/champions/ChampionsPackageTypes';

export function validateChampionsPackageCompleteness(data: ChampionsCompetitivePackage): string[] {
  const errors: string[] = [];
  if (!data.regulation) errors.push('regulation is required');
  if (!data.sourceManifest) errors.push('sourceManifest is required');
  if (!data.restrictions) errors.push('restrictions is required');
  if (data.sourceManifest && data.sourceManifest.sources.length === 0) errors.push('at least one source is required');
  return errors;
}
