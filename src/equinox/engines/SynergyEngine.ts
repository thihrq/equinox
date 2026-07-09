import { AnalysisContext, PokemonData, SynergyAnalysis } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { getVariant } from '../utils/PokemonUtils';

export class SynergyEngine implements AnalysisEngine {
  public readonly name = 'SynergyEngine';

  public execute(context: AnalysisContext): void {
    const format = context.format;
    const team = context.selectedPokemon;

    // 1. Climas
    const weatherAnalysis = this.analyzeWeather(team);
    // 2. Terrenos
    const terrainAnalysis = this.analyzeTerrain(team);
    // 3. Trick Room
    const trickRoomAnalysis = this.analyzeTrickRoom(team, format);
    // 4. Momentum (Volt-Turn)
    const momentumAnalysis = this.analyzeMomentum(team);
    // 5. Item Clause
    const itemClauseAnalysis = this.analyzeItemClause(team, format);

    const totalSynergyScore =
      weatherAnalysis.score +
      terrainAnalysis.score +
      trickRoomAnalysis.score +
      momentumAnalysis.score +
      itemClauseAnalysis.score;

    const analysis: SynergyAnalysis = {
      weatherScore: weatherAnalysis.score,
      terrainScore: terrainAnalysis.score,
      trickRoomScore: trickRoomAnalysis.score,
      momentumScore: momentumAnalysis.score,
      itemClauseScore: itemClauseAnalysis.score,
      totalSynergyScore,
    };

    context.analysis.synergy = analysis;
    context.score.synergy = totalSynergyScore;

    // Explicações para o usuário
    this.generateExplanations(context, weatherAnalysis, terrainAnalysis, trickRoomAnalysis, momentumAnalysis, itemClauseAnalysis);
  }

  // --- Helpers auxiliares para normalização e busca ---

  private normalize(str?: string): string {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private hasAbility(pokemon: PokemonData, abilityName: string): boolean {
    const target = this.normalize(abilityName);
    
    // Habilidade explícita do Pokémon no time
    if (pokemon.ability) {
      return this.normalize(pokemon.ability) === target;
    }

    // Se estiver nas habilidades possíveis (abilities record)
    if (pokemon.abilities) {
      for (const key in pokemon.abilities) {
        if (this.normalize(pokemon.abilities[key]) === target) {
          return true;
        }
      }
    }

    // Verificação de tags competitivas como fallback
    const tags = [
      ...(pokemon.competitive?.utilityTags ?? []),
      ...(pokemon.competitive?.offensiveTags ?? []),
      ...(pokemon.competitive?.defensiveTags ?? []),
    ];
    if (tags.some(tag => this.normalize(tag) === target)) {
      return true;
    }

    return false;
  }

  private hasMove(pokemon: PokemonData, moveName: string): boolean {
    const target = this.normalize(moveName);

    if (pokemon.moves) {
      return pokemon.moves.some(move => this.normalize(move) === target);
    }

    // Fallback para tags de utilidade ou ofensivas
    const tags = [
      ...(pokemon.competitive?.utilityTags ?? []),
      ...(pokemon.competitive?.offensiveTags ?? []),
    ];
    return tags.some(tag => this.normalize(tag) === target);
  }

  // --- 1. Lógica de Climas (Weather) ---

  private analyzeWeather(team: PokemonData[]): { score: number; activeSynergies: string[]; conflicts: string[] } {
    let score = 0;
    const activeSynergies: string[] = [];
    const conflicts: string[] = [];

    const weatherTypes = [
      {
        name: 'Chuva',
        setters: ['drizzle', 'primordialsea'],
        beneficiaries: ['swiftswim', 'raindish', 'dryskin', 'hydration']
      },
      {
        name: 'Sol',
        setters: ['drought', 'orichalcumpulse', 'desolateland'],
        beneficiaries: ['chlorophyll', 'solarpower', 'protosynthesis', 'flowergift', 'harvest']
      },
      {
        name: 'Areia',
        setters: ['sandstream', 'sandspit'],
        beneficiaries: ['sandrush', 'sandforce', 'sandveil', 'overcoat']
      },
      {
        name: 'Neve',
        setters: ['snowwarning'],
        beneficiaries: ['slushrush', 'icebody', 'snowcloak']
      }
    ];

    const activeSetters: string[] = [];

    for (const w of weatherTypes) {
      let hasSetter = false;
      let hasBeneficiary = false;

      for (const p of team) {
        // Verifica se é setter
        const isSetter = w.setters.some(s => this.hasAbility(p, s));
        if (isSetter) {
          hasSetter = true;
        }

        // Verifica se é beneficiário
        const isBeneficiary = w.beneficiaries.some(b => this.hasAbility(p, b));
        if (isBeneficiary) {
          hasBeneficiary = true;
        }
      }

      if (hasSetter) {
        activeSetters.push(w.name);
      }

      if (hasSetter && hasBeneficiary) {
        score += 25;
        activeSynergies.push(w.name);
      }
    }

    // Conflito de clima: 2 ou mais setters de climas diferentes
    if (activeSetters.length >= 2) {
      score -= 45;
      conflicts.push(...activeSetters);
    }

    return { score, activeSynergies, conflicts };
  }

  // --- 2. Lógica de Terrenos (Terrain) ---

  private analyzeTerrain(team: PokemonData[]): { score: number; activeSynergies: string[]; conflicts: string[] } {
    let score = 0;
    const activeSynergies: string[] = [];
    const conflicts: string[] = [];

    const terrainTypes = [
      {
        name: 'Terreno Psíquico',
        setters: ['psychicsurge'],
        beneficiaries: ['expandingforce'] // Movimento
      },
      {
        name: 'Terreno de Grama',
        setters: ['grassysurge'],
        beneficiaries: ['grassglide'] // Movimento
      },
      {
        name: 'Terreno Elétrico',
        setters: ['electricsurge'],
        beneficiaries: ['risingvoltage', 'quarkdrive'] // Movimento / Habilidade
      },
      {
        name: 'Terreno de Névoa',
        setters: ['mistysurge'],
        beneficiaries: ['mistyexplosion'] // Movimento
      }
    ];

    const activeSetters: string[] = [];

    for (const t of terrainTypes) {
      let hasSetter = false;
      let hasBeneficiary = false;

      for (const p of team) {
        // Verifica setter (habilidade)
        const isSetter = t.setters.some(s => this.hasAbility(p, s));
        if (isSetter) {
          hasSetter = true;
        }

        // Verifica beneficiário (movimento ou habilidade)
        const isBeneficiary = t.beneficiaries.some(b => this.hasMove(p, b) || this.hasAbility(p, b));
        if (isBeneficiary) {
          hasBeneficiary = true;
        }
      }

      if (hasSetter) {
        activeSetters.push(t.name);
      }

      if (hasSetter && hasBeneficiary) {
        score += 20;
        activeSynergies.push(t.name);
      }
    }

    // Conflito de terrenos: 2 ou mais setters de terrenos diferentes
    if (activeSetters.length >= 2) {
      score -= 35;
      conflicts.push(...activeSetters);
    }

    return { score, activeSynergies, conflicts };
  }

  // --- 3. Lógica de Trick Room ---

  private analyzeTrickRoom(team: PokemonData[], format: string): { score: number; isSynergistic: boolean; isConflicting: boolean } {
    let hasSetter = false;
    let slowCount = 0;
    let fastCount = 0;

    for (const p of team) {
      // Detector de Trick Room Setter
      if (this.hasMove(p, 'Trick Room') || this.hasAbility(p, 'Trick Room')) {
        hasSetter = true;
      }

      const variant = getVariant(p, format);
      const baseSpeed = Number(variant?.baseStats?.spe ?? 80);

      if (baseSpeed <= 55) {
        slowCount++;
      }
      if (baseSpeed >= 100) {
        fastCount++;
      }
    }

    let score = 0;
    let isSynergistic = false;
    let isConflicting = false;

    if (hasSetter) {
      // Trick Room Sinergético: Setter + 2 ou mais Pokémon lentos (<= 55 Spe)
      if (slowCount >= 2) {
        score += 20;
        isSynergistic = true;
      }
      // Conflito de Trick Room: Setter + 2 ou mais Pokémon rápidos (>= 100 Spe)
      if (fastCount >= 2) {
        score -= 30;
        isConflicting = true;
      }
    }

    return { score, isSynergistic, isConflicting };
  }

  // --- 4. Lógica de Momentum (Volt-Turn) ---

  private analyzeMomentum(team: PokemonData[]): { score: number; count: number } {
    let pivotCount = 0;
    const pivotMoves = ['Volt Switch', 'U-turn', 'Flip Turn', 'Parting Shot'];

    for (const p of team) {
      const hasPivot = pivotMoves.some(move => this.hasMove(p, move));
      if (hasPivot) {
        pivotCount++;
      }
    }

    const score = pivotCount >= 2 ? 15 : 0;
    return { score, count: pivotCount };
  }

  // --- 5. Lógica de Item Clause ---

  private analyzeItemClause(team: PokemonData[], format: string): { score: number; violated: boolean } {
    const items = team
      .map(p => this.normalize(p.item))
      .filter(item => item !== '' && item !== 'none' && item !== 'noitem');

    const uniqueItems = new Set(items);
    const hasDuplicates = items.length !== uniqueItems.size;

    const isChampionsOrVgc = !!format && (format.toLowerCase().includes('champions') || format.toLowerCase().includes('vgc'));
    const violated = hasDuplicates && isChampionsOrVgc;
    const score = violated ? -50 : 0;

    return { score, violated };
  }

  // --- Gerador de Explicações ---

  private generateExplanations(
    context: AnalysisContext,
    weather: ReturnType<typeof SynergyEngine.prototype.analyzeWeather>,
    terrain: ReturnType<typeof SynergyEngine.prototype.analyzeTerrain>,
    trickRoom: ReturnType<typeof SynergyEngine.prototype.analyzeTrickRoom>,
    momentum: ReturnType<typeof SynergyEngine.prototype.analyzeMomentum>,
    itemClause: ReturnType<typeof SynergyEngine.prototype.analyzeItemClause>
  ): void {
    // Climas
    for (const name of weather.activeSynergies) {
      context.addExplanation({
        engine: this.name,
        reason: `Sinergia de Clima Ativa: ${name} (Setter + Beneficiário)`,
        value: 25,
        impact: 'positive',
      });
    }

    if (weather.conflicts.length > 0) {
      context.addExplanation({
        engine: this.name,
        reason: `Conflito de Clima Detectado: Múltiplos climas conflitantes no time (${weather.conflicts.join(', ')})`,
        value: -45,
        impact: 'negative',
      });
    }

    // Terrenos
    for (const name of terrain.activeSynergies) {
      context.addExplanation({
        engine: this.name,
        reason: `Sinergia de Terreno Ativa: ${name} (Setter + Beneficiário/Golpe)`,
        value: 20,
        impact: 'positive',
      });
    }

    if (terrain.conflicts.length > 0) {
      context.addExplanation({
        engine: this.name,
        reason: `Conflito de Terrenos Detectado: Múltiplos terrenos conflitantes no time (${terrain.conflicts.join(', ')})`,
        value: -35,
        impact: 'negative',
      });
    }

    // Trick Room
    if (trickRoom.isSynergistic) {
      context.addExplanation({
        engine: this.name,
        reason: 'Sinergia de Trick Room: Setter presente com pelo menos 2 Pokémon lentos (<= 55 Spe)',
        value: 20,
        impact: 'positive',
      });
    }

    if (trickRoom.isConflicting) {
      context.addExplanation({
        engine: this.name,
        reason: 'Conflito de Trick Room: Setter presente com pelo menos 2 Pokémon rápidos (>= 100 Spe)',
        value: -30,
        impact: 'negative',
      });
    }

    // Momentum
    if (momentum.score > 0) {
      context.addExplanation({
        engine: this.name,
        reason: `Excelente Momentum: ${momentum.count} Pokémon com golpes de pivot (Volt Switch/U-turn/etc.)`,
        value: 15,
        impact: 'positive',
      });
    }

    // Item Clause
    if (itemClause.violated) {
      context.addExplanation({
        engine: this.name,
        reason: 'Violação de Item Clause: Dois ou mais Pokémon carregam o mesmo item em formato oficial',
        value: -50,
        impact: 'negative',
      });
    }
  }
}
