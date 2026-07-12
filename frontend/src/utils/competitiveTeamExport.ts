import type { CompetitivePokemonSet, PokemonData } from '../types/lead';

function getSet(member: PokemonData): CompetitivePokemonSet | null {
  if (member.competitiveSet) return member.competitiveSet;
  if (!member.item || !member.ability || !member.nature || !member.moves || member.moves.length !== 4) {
    return null;
  }
  return {
    name: member.name,
    types: member.types ?? [],
    item: member.item,
    ability: member.ability,
    nature: member.nature,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: member.moves as [string, string, string, string],
    role: member.role,
    level: 50,
    setSource: 'generated',
    validation: { legal: true, errors: [], warnings: [] },
  };
}

function formatSpread(label: string, spread: CompetitivePokemonSet['evs']): string {
  const entries = [
    ['HP', spread.hp],
    ['Atk', spread.atk],
    ['Def', spread.def],
    ['SpA', spread.spa],
    ['SpD', spread.spd],
    ['Spe', spread.spe],
  ].filter(([, value]) => Number(value) > 0);
  return entries.length ? `${label}: ${entries.map(([stat, value]) => `${value} ${stat}`).join(' / ')}` : '';
}

function formatIvs(spread: CompetitivePokemonSet['ivs']): string {
  const relevant = [
    ['HP', spread.hp],
    ['Atk', spread.atk],
    ['Def', spread.def],
    ['SpA', spread.spa],
    ['SpD', spread.spd],
    ['Spe', spread.spe],
  ].filter(([, value]) => Number(value) !== 31);
  return relevant.length ? `IVs: ${relevant.map(([stat, value]) => `${value} ${stat}`).join(' / ')}` : '';
}

export function getCompetitiveSets(team: PokemonData[]): CompetitivePokemonSet[] {
  return team.map(getSet).filter(Boolean) as CompetitivePokemonSet[];
}

export function hasExportBlockingIssue(team: PokemonData[]): boolean {
  const sets = getCompetitiveSets(team);
  if (sets.length !== team.length) return true;
  const items = sets.map(set => set.item).filter(Boolean);
  return sets.some(set => !set.validation.legal || set.moves.length !== 4 || !set.nature) ||
    new Set(items.map(item => item.toLowerCase())).size !== items.length;
}

export function toShowdown(team: PokemonData[]): string {
  return getCompetitiveSets(team).map(set => {
    const lines = [
      `${set.name} @ ${set.item}`,
      `Ability: ${set.ability}`,
      set.level ? `Level: ${set.level}` : '',
      formatSpread('EVs', set.evs),
      formatIvs(set.ivs),
      `${set.nature} Nature`,
      ...set.moves.map(move => `- ${move}`),
    ].filter(Boolean);
    return lines.join('\n');
  }).join('\n\n');
}

export function toPlainText(team: PokemonData[]): string {
  return getCompetitiveSets(team)
    .map(set => `${set.name}: ${set.item}, ${set.ability}, ${set.nature}, ${set.moves.join(' / ')}`)
    .join('\n');
}

export function toJson(team: PokemonData[], strategy?: unknown): string {
  return JSON.stringify({ team: getCompetitiveSets(team), strategy }, null, 2);
}

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
