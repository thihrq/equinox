import { AnalysisContext, PokemonData } from '../core/AnalysisContext';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { CoachAnalysis } from './CoachAnalysis';
import { CoachTemplates } from './CoachTemplates';

export class CoachInterpreter {
  public interpret(context: AnalysisContext): CoachAnalysis {
    const leadSuggestions = this.getLeadSuggestions(context);
    const keyPokemon = this.getKeyPokemon(context);
    const preservePokemon = this.getPreservePokemon(context);
    const winConditions = this.getWinConditions(context);
    const switchPatterns = this.getSwitchPatterns(context);

    const dangerousThreats = context.analysis.threats?.dangerousThreats ?? [];
    const criticalThreats = context.analysis.threats?.criticalThreats ?? [];
    const missingRoles = context.analysis.roles?.missingRoles ?? [];
    const hasSpeedControl = context.analysis.speed?.hasSpeedControl ?? false;

    const earlyGame = [
      leadSuggestions.length > 0
        ? `Considere abrir com ${leadSuggestions[0]} para testar o ritmo da partida sem expor sua condição de vitória cedo.`
        : 'Abra de forma conservadora para identificar o plano adversário antes de comprometer suas principais peças.',
      missingRoles.includes('Hazard Removal')
        ? 'Evite deixar hazards acumularem, pois o time não possui remoção clara detectada.'
        : 'Use o início para estabelecer controle de hazards e manter suas respostas defensivas saudáveis.',
      criticalThreats.length > 0
        ? `Identifique cedo como o adversário pretende usar ${criticalThreats[0].threat.name}; essa é uma das maiores pressões para sua composição.`
        : 'Faça scouting nos primeiros turnos para descobrir itens, velocidade e possíveis moves de cobertura.',
    ];

    const midGame = [
      dangerousThreats.length > 0
        ? `No meio da partida, mantenha recursos suficientes para responder a ${dangerousThreats[0].threat.name}.`
        : 'Use o meio da partida para transformar trocas neutras em vantagem de posicionamento.',
      keyPokemon.length > 0
        ? `Crie entradas seguras para ${keyPokemon[0]}, pois ele é uma das peças que mais estabiliza ou pressiona o matchup.`
        : 'Procure preservar o equilíbrio entre defesa e pressão ofensiva.',
      hasSpeedControl
        ? 'Aproveite seu controle de velocidade para forçar trocas e impedir setups gratuitos.'
        : 'Evite entregar turnos grátis para sweepers rápidos, pois o time não possui speed control claro.',
    ];

    const lateGame = [
      winConditions.length > 0
        ? `Planeje o final da partida ao redor de ${winConditions[0]}; enfraqueça seus checks antes de tentar finalizar.`
        : 'No late game, priorize o Pokémon com melhor matchup restante em vez de buscar trocas arriscadas.',
      context.analysis.offensiveCoverage && context.analysis.offensiveCoverage.coverageRatio >= 0.7
        ? 'Sua cobertura ofensiva permite pressionar boa parte dos tipos; use isso para evitar que o adversário estabilize.'
        : 'Como a cobertura ofensiva não é perfeita, tente remover ou enfraquecer os tipos que o time pressiona pior.',
      preservePokemon.length > 0
        ? `Não sacrifique ${preservePokemon[0]} sem necessidade; ele cobre ameaças importantes para o plano final.`
        : 'Evite sacrificar pivots ou walls cedo demais, pois eles podem ser necessários para fechar a partida com segurança.',
    ];

    return {
      overview: this.buildOverview(context),
      earlyGame: this.dedupe(earlyGame),
      midGame: this.dedupe(midGame),
      lateGame: this.dedupe(lateGame),
      winConditions,
      keyPokemon,
      preservePokemon,
      sacrificeCandidates: this.getSacrificeCandidates(context, preservePokemon, winConditions),
      leadSuggestions,
      switchPatterns,
    };
  }

  private buildOverview(context: AnalysisContext): string {
    const metaName = context.analysis.meta?.name ?? context.format;
    const threatScore = context.analysis.threats?.averageScore ?? 0;
    const speedProfile = context.analysis.speed?.speedProfile ?? 'Balanced';

    const identity = CoachTemplates.byIdentity(context.teamIdentity ?? 'balanced');

    return `${identity} Meta analisado: ${metaName}. Perfil de velocidade: ${speedProfile}. Índice médio contra ameaças: ${threatScore}%.`;
  }

  private getLeadSuggestions(context: AnalysisContext): string[] {
    const members = [...context.selectedPokemon];

    const pivots = members.filter(member => this.memberHasRole(context, member.name, 'Pivot'));
    if (pivots.length > 0) return pivots.slice(0, 2).map(member => member.name);

    const bulky = members
      .map(member => ({ member, bulk: this.getBulk(member, context.format), speed: this.getSpeed(member, context.format) }))
      .sort((a, b) => (b.bulk + b.speed / 3) - (a.bulk + a.speed / 3));

    return bulky.slice(0, 2).map(item => item.member.name);
  }

  private getKeyPokemon(context: AnalysisContext): string[] {
    const names = new Set<string>();

    const fastest = context.analysis.speed?.fastestPokemon?.name;
    if (fastest) names.add(fastest);

    for (const matchup of context.analysis.threats?.criticalThreats ?? []) {
      for (const answer of matchup.answers) {
        const found = context.selectedPokemon.find(member => answer.includes(member.name));
        if (found) names.add(found.name);
      }
    }

    for (const matchup of context.analysis.threats?.dangerousThreats ?? []) {
      for (const answer of matchup.answers) {
        const found = context.selectedPokemon.find(member => answer.includes(member.name));
        if (found) names.add(found.name);
      }
    }

    if (names.size === 0) {
      this.getWinConditionMembers(context).slice(0, 2).forEach(member => names.add(member.name));
    }

    return [...names].slice(0, 4);
  }

  private getPreservePokemon(context: AnalysisContext): string[] {
    const preserve = new Map<string, number>();

    for (const matchup of [
      ...(context.analysis.threats?.criticalThreats ?? []),
      ...(context.analysis.threats?.dangerousThreats ?? []),
    ]) {
      for (const answer of matchup.answers) {
        const found = context.selectedPokemon.find(member => answer.includes(member.name));
        if (found) preserve.set(found.name, (preserve.get(found.name) ?? 0) + 1);
      }
    }

    return [...preserve.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 4);
  }

  private getWinConditions(context: AnalysisContext): string[] {
    return this.getWinConditionMembers(context)
      .map(member => {
        const speed = this.getSpeed(member, context.format);
        const stats = getVariant(member, context.format)?.baseStats;
        const atk = Number(stats?.atk ?? 0);
        const spa = Number(stats?.spa ?? 0);

        if (speed >= 100) return `${member.name} como cleaner rápido no late game`;
        if (atk >= 110 || spa >= 110) return `${member.name} como wallbreaker para abrir caminho`;
        return `${member.name} como condição flexível de pressão`;
      })
      .slice(0, 3);
  }

  private getWinConditionMembers(context: AnalysisContext): PokemonData[] {
    return [...context.selectedPokemon]
      .map(member => {
        const stats = getVariant(member, context.format)?.baseStats;
        const atk = Number(stats?.atk ?? 0);
        const spa = Number(stats?.spa ?? 0);
        const spe = Number(stats?.spe ?? 0);
        return { member, value: Math.max(atk, spa) + spe * 0.7 };
      })
      .sort((a, b) => b.value - a.value)
      .map(item => item.member);
  }

  private getSacrificeCandidates(
    context: AnalysisContext,
    preservePokemon: string[],
    winConditions: string[],
  ): string[] {
    const protectedNames = new Set([
      ...preservePokemon,
      ...winConditions.map(condition => condition.split(' ')[0]),
    ]);

    return [...context.selectedPokemon]
      .filter(member => !protectedNames.has(member.name))
      .sort((a, b) => this.getBulk(a, context.format) - this.getBulk(b, context.format))
      .slice(0, 3)
      .map(member => `${member.name} pode ser usado como sacrifício tático se já tiver cumprido sua função.`);
  }

  private getSwitchPatterns(context: AnalysisContext): string[] {
    const patterns: string[] = [];
    const priorityTypes = ['Ground', 'Fire', 'Water', 'Electric', 'Ice', 'Fighting', 'Dragon', 'Fairy', 'Ghost', 'Dark'];

    for (const attackType of priorityTypes) {
      const bestSwitch = [...context.selectedPokemon]
        .map(member => ({
          member,
          multiplier: getDamageMultiplier(getPokemonTypes(member, context.format), attackType),
        }))
        .sort((a, b) => a.multiplier - b.multiplier)[0];

      if (!bestSwitch) continue;

      if (bestSwitch.multiplier === 0) {
        patterns.push(`Contra golpes ${attackType}, ${bestSwitch.member.name} é a entrada ideal por imunidade.`);
      } else if (bestSwitch.multiplier <= 0.5) {
        patterns.push(`Contra golpes ${attackType}, considere entrar com ${bestSwitch.member.name}, que resiste bem.`);
      }
    }

    return this.dedupe(patterns).slice(0, 6);
  }

  private memberHasRole(context: AnalysisContext, memberName: string, role: string): boolean {
    const member = context.selectedPokemon.find(pokemon => pokemon.name === memberName);
    if (!member) return false;

    if (member.competitive?.roles?.includes(role)) return true;

    const stats = getVariant(member, context.format)?.baseStats;
    if (!stats) return false;

    const hp = Number(stats.hp ?? 0);
    const def = Number(stats.def ?? 0);
    const spd = Number(stats.spd ?? 0);
    const spe = Number(stats.spe ?? 0);

    return role === 'Pivot' && hp >= 80 && spe < 100 && (def >= 85 || spd >= 85);
  }

  private getBulk(member: PokemonData, format: string): number {
    const stats = getVariant(member, format)?.baseStats;
    return Number(stats?.hp ?? 0) + Number(stats?.def ?? 0) + Number(stats?.spd ?? 0);
  }

  private getSpeed(member: PokemonData, format: string): number {
    return Number(getVariant(member, format)?.baseStats?.spe ?? 0);
  }

  private dedupe(values: string[]): string[] {
    return [...new Set(values)].filter(Boolean);
  }
}
