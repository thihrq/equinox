import { ChampionsCompetitivePackage } from './ChampionsPackageTypes';

declare const require: (moduleName: string) => any;
const fs = require('fs') as { readFileSync(filePath: string, encoding: string): string };
const path = require('path') as { resolve(...parts: string[]): string; join(...parts: string[]): string };

export function loadChampionsCompetitivePackage(
  packageDirectory = path.resolve('src/equinox/data-packs/competitive/champions-reg-mb-doubles'),
): ChampionsCompetitivePackage {
  const readJson = <T>(fileName: string): T => JSON.parse(fs.readFileSync(path.join(packageDirectory, fileName), 'utf8')) as T;
  const readRecords = <T>(fileName: string, key: string): T[] => {
    const payload = readJson<Record<string, unknown>>(fileName);
    const records = payload[key];
    if (!Array.isArray(records)) throw new Error(`${fileName} must contain an array at ${key}`);
    return records as T[];
  };

  return {
    regulation: readJson('regulation.json'),
    roster: readRecords('roster.json', 'pokemon'),
    species: readRecords('species.json', 'species'),
    moves: readRecords('moves.json', 'moves'),
    abilities: readRecords('abilities.json', 'abilities'),
    items: readRecords('items.json', 'items'),
    learnsets: readRecords('learnsets.json', 'learnsets'),
    restrictions: readJson('restrictions.json'),
    sourceManifest: readJson('source-manifest.json'),
  };
}
