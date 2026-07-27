export interface PrimaryFinalistPolicy {
  readonly initialFinalistsPerStrategy: number;
  readonly maximumFinalistsPerStrategy: number;
  readonly maximumFinalistsPerRequest: number;
  readonly beamWidth: number;
}

export function resolvePrimaryFinalistPolicy(
  runtimeProfile: string,
): PrimaryFinalistPolicy {
  if (runtimeProfile === 'render_free') {
    return {
      initialFinalistsPerStrategy: 2,
      maximumFinalistsPerStrategy: 4,
      maximumFinalistsPerRequest: 8,
      beamWidth: 24,
    };
  }

  return {
    initialFinalistsPerStrategy: 5,
    maximumFinalistsPerStrategy: 8,
    maximumFinalistsPerRequest: 16,
    beamWidth: 40,
  };
}
