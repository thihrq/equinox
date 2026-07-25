import { ChampionsRegulation } from '../../data-packs/champions/ChampionsPackageTypes';

export function importChampionsOfficialRegulation(input: unknown): ChampionsRegulation {
  const regulation = input as Partial<ChampionsRegulation>;
  if (regulation.regulationId !== 'M-B' || regulation.formatId !== 'champions_reg_m_b_doubles') {
    throw new Error('official regulation must be M-B doubles');
  }
  if (regulation.itemClause !== true || regulation.maxMegaEvolutionsPerBattle !== 1) {
    throw new Error('official regulation is missing item or Mega rules');
  }
  return regulation as ChampionsRegulation;
}
