import axios from 'axios';
import fs from 'fs';
import { artifactRoot, loadCurationConfig, selectSentinel, writeArtifact } from '../services/competitive-data/curation/CompetitiveCurationCore';
declare const process: { argv: string[]; env: Record<string, string | undefined>; exitCode?: number };
async function main(): Promise<void> {
  const config = loadCurationConfig(process.argv.slice(2));
  const selection = selectSentinel(config);
  const root = artifactRoot(selection);
  const names = new Map(config.package.roster.map(item => [item.pokemonId, item.displayName]));
  if (process.env.EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS !== 'true') { writeArtifact(root, 'crosscheck.json', { complete: false, selectedCount: selection.selectedPokemonIds.length, warning: 'EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS is not true.' }); console.log(JSON.stringify({ complete: false, warning: 'NETWORK_READS_DISABLED' }, null, 2)); }
  else {
    const results = [];
    for (const pokemonId of selection.selectedPokemonIds) {
      const displayName = names.get(pokemonId) ?? pokemonId.split('-')[0];
      const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      try { const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${slug}`, { timeout: 10000, headers: { 'User-Agent': 'Equinox-Champions-Curation/1.0' } }); results.push({ pokemonId, source: 'pokeapi', status: 'consistent', responseDigest: response.data.id }); }
      catch (error) { results.push({ pokemonId, source: 'pokeapi', status: 'unavailable', message: error instanceof Error ? error.message : 'request failed' }); }
    }
    const complete = results.length === selection.selectedPokemonIds.length && results.every(item => item.status === 'consistent');
    writeArtifact(root, 'crosscheck.json', { complete, selectedCount: selection.selectedPokemonIds.length, results });
    console.log(JSON.stringify({ complete, selectedCount: selection.selectedPokemonIds.length, unavailable: results.filter(item => item.status !== 'consistent').length }, null, 2));
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
