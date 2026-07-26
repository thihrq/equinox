import * as crypto from 'crypto';

export interface CanonicalEvaluationContext {
  format: string;
  strategyId: string;
  strategyProfileId: string;

  weather?: string;
  terrain?: string;
  speedMode?: string;

  evaluatorVersion?: string;
  qualityGateVersion?: string;
}

export interface CanonicalPokemonBuildIdentity {
  canonicalSpecies: string;
  form?: string;
  setId: string;

  item?: string;
  ability?: string;
  nature?: string;

  evs?: Readonly<Record<string, number>>;
  ivs?: Readonly<Record<string, number>>;

  moves: readonly string[];
}

function normalizeSortedRecord(rec?: Readonly<Record<string, number>>): Record<string, number> {
  if (!rec) return {};
  const sortedKeys = Object.keys(rec).sort();
  const res: Record<string, number> = {};
  for (const k of sortedKeys) {
    res[k] = rec[k];
  }
  return res;
}

export function createCanonicalTeamEvaluationKey(
  context: CanonicalEvaluationContext,
  team: readonly CanonicalPokemonBuildIdentity[],
): string {
  const normContext = {
    format: context.format,
    strategyId: context.strategyId,
    strategyProfileId: context.strategyProfileId,
    weather: context.weather || 'none',
    terrain: context.terrain || 'none',
    speedMode: context.speedMode || 'normal',
    evaluatorVersion: context.evaluatorVersion || 'v1.1.3',
    qualityGateVersion: context.qualityGateVersion || 'v1.1.2',
  };

  const normTeam = team.map(m => ({
    canonicalSpecies: m.canonicalSpecies,
    form: m.form || 'base',
    setId: m.setId,
    item: m.item || 'none',
    ability: m.ability || 'none',
    nature: m.nature || 'hardy',
    evs: normalizeSortedRecord(m.evs),
    ivs: normalizeSortedRecord(m.ivs),
    moves: [...m.moves].sort(),
  }));

  const payload = JSON.stringify({ context: normContext, team: normTeam });
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  return `sha256:${hash}`;
}
