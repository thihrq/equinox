import { digestWithout, stableDigest } from './ReferenceConformanceContracts';

const run = (): void => {
  const value = { input: { level: 50 }, output: 123, fixtureDigest: 'ignored' };
  if (stableDigest(value) !== stableDigest(value)) throw new Error('stable digest is not deterministic');
  if (digestWithout(value, ['fixtureDigest']) === stableDigest(value)) throw new Error('fixture digest was not excluded');
  console.log(JSON.stringify({ valid: true, contract: 'reference-conformance', mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
};

run();
