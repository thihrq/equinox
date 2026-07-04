import { TYPE_CHART } from '../../utils/TypeChart';
import { EvaluatedCombination } from './CombinationSearchEngine';
import { PokemonData } from '../core/AnalysisContext';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { generateBasicKit, getPokemonTypes } from '../utils/PokemonUtils';

export interface CandidateDiversityInsight {
  name: string;
  score: number;
  roles: string[];
  types: string[];
  reasons: string[];
}

export interface CandidateDiversitySummary {
  rawCandidates: number;
  validCandidates: number;
  scoredCandidates: number;
  diversifiedCandidates: number;
  topCandidates: CandidateDiversityInsight[];
}

export interface BattleInsight {
  practicalRole: string;
  offers: string[];
  pressures: string[];
  risks: string[];
  usageTip: string;
}

export class RecommendationAdapter {
  public toLegacyResponse(
    combinations: EvaluatedCombination[],
    format: string,
    candidateDiversity?: CandidateDiversitySummary,
  ) {
    const topTeams: any[] = [];
    const usedPokemon = new Set<string>();

    for (const combination of combinations) {
      if (topTeams.length >= 5) break;

      const names = combination.team.map(pokemon => pokemon.name);
      const hasRepeatedPokemon = names.some(name => usedPokemon.has(name));

      const megaCount = combination.context.selectedPokemon.filter(pokemon =>
        pokemon.name.toLowerCase().includes('-mega'),
      ).length;

      if (!hasRepeatedPokemon && megaCount <= 1) {
        topTeams.push(this.formatOption(combination, format, topTeams.length));
        names.forEach(name => usedPokemon.add(name));
      }
    }

    if (topTeams.length < 5) {
      for (const combination of combinations) {
        if (topTeams.length >= 5) break;

        const namesString = combination.team
          .map(pokemon => pokemon.name)
          .sort()
          .join(',');

        const alreadyAdded = topTeams.some(option => {
          const existingNames = option.suggestedPokemons
            .map((pokemon: any) => pokemon.name)
            .sort()
            .join(',');

          return existingNames === namesString;
        });

        const megaCount = combination.context.selectedPokemon.filter(pokemon =>
          pokemon.name.toLowerCase().includes('-mega'),
        ).length;

        if (!alreadyAdded && megaCount <= 1) {
          topTeams.push(this.formatOption(combination, format, topTeams.length));
        }
      }
    }

    return {
      topTeams,
      candidateDiversity,
    };
  }

  private formatOption(
    combination: EvaluatedCombination,
    format: string,
    index: number,
  ) {
    const { context } = combination;

    const reasoning =
      context.analysis.fatalUncovered === 0 &&
      context.analysis.normalUncovered === 0
        ? `Opção ${index + 1}: Perfeição Alcançada. Zero fraquezas fatais ou normais sem Switch-in ideal.`
        : `Opção ${index + 1}: Equilíbrio Estratégico. Restaram ${context.analysis.fatalUncovered} falha(s) 4x e ${context.analysis.normalUncovered} falha(s) 2x expostas.`;

    return {
      suggestedPokemons: combination.team.map(pokemon => ({
        name: pokemon.name,
        kit: generateBasicKit(pokemon, format),
        battleInsight: this.buildBattleInsight(pokemon, format),
      })),
      reasoning,
      stats: {
        fatalUncovered: context.analysis.fatalUncovered,
        normalUncovered: context.analysis.normalUncovered,
        totalWeaknesses: context.analysis.totalWeaknesses,
      },
      score: context.score,
      explanations: context.explanations,
      roles: context.analysis.roles,
      speed: context.analysis.speed,
      offensiveCoverage: context.analysis.offensiveCoverage,
      threatAnalysis: context.analysis.threats,
      metaAnalysis: context.analysis.meta,
      coach: context.analysis.coach,
      damageReport: context.analysis.damage,
      aiBuilder: context.analysis.aiBuilder,
      formatIntelligence: context.analysis.formatIntelligence,
      radicalRedGauntlet: context.analysis.radicalRedGauntlet,
      championsRegulation: context.analysis.championsRegulation,
      dataSourceReport: context.analysis.dataSources,
    };
  }

  private buildBattleInsight(pokemon: PokemonData, format: string): BattleInsight {
    const types = getPokemonTypes(pokemon, format);
    const kit = generateBasicKit(pokemon, format);

    const offers = this.getDefensiveOffers(types);
    const pressures = this.getOffensivePressures(types);
    const risks = this.getDefensiveRisks(types);

    return {
      practicalRole: this.getPracticalRole(kit.role, types),
      offers: offers.slice(0, 5),
      pressures: pressures.slice(0, 5),
      risks: risks.slice(0, 4),
      usageTip: this.getUsageTip(kit.role, offers, pressures, risks),
    };
  }

  private getDefensiveOffers(types: string[]): string[] {
    const offers: string[] = [];

    for (const attackType of Object.keys(TYPE_CHART)) {
      const multiplier = getDamageMultiplier(types, attackType);

      if (multiplier === 0) {
        offers.push(`Entra gratuitamente contra golpes ${attackType}`);
      } else if (multiplier <= 0.25) {
        offers.push(`Absorve muito bem golpes ${attackType}`);
      } else if (multiplier <= 0.5) {
        offers.push(`Resiste a golpes ${attackType}`);
      }
    }

    return offers;
  }

  private getOffensivePressures(types: string[]): string[] {
    const pressures = new Set<string>();

    for (const attackType of types) {
      const resolvedAttackType = this.resolveTypeKey(attackType);

      if (!resolvedAttackType) continue;

      for (const defendingType of Object.keys(TYPE_CHART)) {
        const multiplier = TYPE_CHART[resolvedAttackType]?.[defendingType] ?? 1;

        if (multiplier > 1) {
          pressures.add(`Pressiona tipos ${defendingType} com STAB ${resolvedAttackType}`);
        }
      }
    }

    return [...pressures];
  }

  private getDefensiveRisks(types: string[]): string[] {
    const risks: string[] = [];

    for (const attackType of Object.keys(TYPE_CHART)) {
      const multiplier = getDamageMultiplier(types, attackType);

      if (multiplier >= 4) {
        risks.push(`Evite exposição direta a golpes ${attackType} (4x)`);
      } else if (multiplier >= 2) {
        risks.push(`Cuidado com golpes ${attackType}`);
      }
    }

    return risks;
  }

  private getPracticalRole(kitRole: string, types: string[]): string {
    if (kitRole.includes('Barreira Física')) return 'Entrada defensiva física';
    if (kitRole.includes('Barreira Especial')) return 'Entrada defensiva especial';
    if (kitRole.includes('Atacante') && kitRole.includes('Rápido')) return 'Revenge killer / pressão rápida';
    if (kitRole.includes('Demolidor')) return 'Wallbreaker para abrir caminho';
    if (kitRole.includes('Suporte')) return 'Pivot de suporte e estabilização';

    if (types.includes('Steel')) return 'Peça defensiva de resistência';
    if (types.includes('Flying')) return 'Pivot com imunidade a Ground';
    if (types.includes('Ghost')) return 'Spinblocker e pressão utilitária';

    return 'Peça flexível de composição';
  }

  private getUsageTip(
    kitRole: string,
    offers: string[],
    pressures: string[],
    risks: string[],
  ): string {
    if (kitRole.includes('Barreira Física') || kitRole.includes('Barreira Especial')) {
      return offers.length > 0
        ? 'Use como entrada segura contra os tipos listados, preservando HP para manter estabilidade defensiva ao longo da partida.'
        : 'Use para absorver dano e estabilizar a partida, evitando trocas diretas contra seus tipos de risco.';
    }

    if (kitRole.includes('Atacante') && kitRole.includes('Rápido')) {
      return pressures.length > 0
        ? 'Use para finalizar alvos enfraquecidos, pressionar matchups favoráveis e recuperar ritmo quando o adversário estiver vulnerável.'
        : 'Use como peça de velocidade para controlar o ritmo e ameaçar Pokémon fragilizados.';
    }

    if (kitRole.includes('Demolidor')) {
      return 'Use para quebrar núcleos defensivos. Evite entrar diretamente em ataques fortes; traga-o por troca segura ou após um nocaute.';
    }

    if (kitRole.includes('Suporte')) {
      return offers.length > 0
        ? 'Use como pivô para entrar em golpes resistidos e criar oportunidades para seus atacantes principais.'
        : 'Use como peça de transição para manter momentum e proteger os membros mais frágeis do time.';
    }

    if (risks.length > 0) {
      return 'Use em matchups favoráveis e evite deixá-lo exposto aos tipos de risco listados.';
    }

    return 'Use como peça flexível para cobrir lacunas do time e criar pressão conforme o matchup exigir.';
  }

  private resolveTypeKey(type: string): string | undefined {
    return Object.keys(TYPE_CHART).find(
      key => key.toLowerCase() === type.toLowerCase(),
    );
  }
}
