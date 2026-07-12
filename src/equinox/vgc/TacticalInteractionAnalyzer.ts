/**
 * TacticalInteractionAnalyzer — Motor de Interações Táticas Dinâmicas
 *
 * Analisa pares e trios de Pokémon dentro de uma equipe e gera
 * TacticalInsight[] verificados contra os golpes, habilidades,
 * tipos e stats reais de cada membro.
 *
 * Cada regra é um objeto independente no array TACTICAL_RULES.
 * Para adicionar novas regras, basta inserir um novo objeto no array.
 */
import type { PokemonData } from '../core/AnalysisContext';
import type { TacticalInsight, TacticalInteractionContext, TacticalRule } from './TacticalInsightTypes';
import { getVariant, getPokemonTypes } from '../utils/PokemonUtils';
import { getDamageMultiplier } from '../utils/DamageMultiplier';

// ─── Helpers ───────────────────────────────────────────────────────────────

function getMoves(p: PokemonData): string[] {
  return (p.moves ?? []).map((m: string) => m.toLowerCase().trim());
}

function hasMove(p: PokemonData, move: string): boolean {
  return getMoves(p).includes(move.toLowerCase().trim());
}

function getAbility(p: PokemonData, format: string): string {
  if (p.ability) return p.ability.toLowerCase().trim();
  const variant = getVariant(p, format);
  const abilities = variant?.abilities ?? p.abilities;
  if (!abilities) return '';
  // Retorna a primeira habilidade disponível
  return String(Object.values(abilities)[0] ?? '').toLowerCase().trim();
}

function hasAbility(p: PokemonData, ability: string, format: string): boolean {
  return getAbility(p, format) === ability.toLowerCase().trim();
}

function getTypes(p: PokemonData, format: string): string[] {
  return getPokemonTypes(p, format).map(t => t.toLowerCase());
}

function hasType(p: PokemonData, type: string, format: string): boolean {
  return getTypes(p, format).includes(type.toLowerCase());
}

function getBaseSpeed(p: PokemonData, format: string): number {
  return Number(getVariant(p, format)?.baseStats?.spe ?? 80);
}

/**
 * Verifica se um Pokémon tem fraqueza a um tipo específico.
 * Usa o calculador real combinatório de multiplicador de dano.
 */
function isWeakTo(p: PokemonData, attackType: string, format: string): boolean {
  const types = getPokemonTypes(p, format);
  return getDamageMultiplier(types, attackType) >= 2.0;
}

// ─── Regras ────────────────────────────────────────────────────────────────

const TACTICAL_RULES: TacticalRule[] = [
  // ── Regra 1: Chuva Reduz Dano Fire ──
  {
    id: 'weather_defense_rain_fire',
    type: 'weather_defense',
    analyze(team, format) {
      const insights: TacticalInsight[] = [];
      const rainSetters = team.filter(p =>
        hasAbility(p, 'drizzle', format) || hasAbility(p, 'primordial sea', format),
      );
      if (rainSetters.length === 0) return insights;

      // Filtra Pokémon que não resistem nativamente a Fire (multiplicador >= 1.0)
      const fireVulnerable = team.filter(p => {
        const types = getPokemonTypes(p, format);
        return getDamageMultiplier(types, 'Fire') >= 1.0;
      });

      for (const setter of rainSetters) {
        for (const target of fireVulnerable) {
          if (setter.name === target.name) continue;

          const types = getPokemonTypes(target, format);
          const multiplier = getDamageMultiplier(types, 'Fire');
          let explanation_ptBR = '';
          let explanation_enUS = '';

          if (multiplier >= 2.0) {
            explanation_ptBR = `A chuva de ${setter.name} reduz em 50% o dano Fire recebido por ${target.name}, mitigando sua fraqueza de tipo.`;
            explanation_enUS = `${setter.name}'s rain reduces Fire damage taken by ${target.name} by 50%, mitigating its type weakness.`;
          } else {
            explanation_ptBR = `A chuva de ${setter.name} reduz o dano de golpes Fire contra ${target.name}, embora esse tipo seja neutro contra sua combinação de tipos.`;
            explanation_enUS = `${setter.name}'s rain reduces Fire damage against ${target.name}, though Fire is neutral against its type combination.`;
          }

          insights.push({
            type: 'weather_defense',
            pokemonInvolved: [setter.name, target.name],
            mechanicsUsed: [getAbility(setter, format)],
            movesRequired: [],
            explanation_ptBR,
            explanation_enUS,
            verified: true,
            missingResources: [],
            impactScore: multiplier >= 2.0 ? 70 : 50,
          });
        }
      }
      return insights;
    },
  },

  // ── Regra 2: Redirecionamento + Setup ──
  {
    id: 'redirection_setup',
    type: 'redirection_setup',
    analyze(team, format) {
      const insights: TacticalInsight[] = [];
      const redirectors = team.filter(p =>
        hasMove(p, 'rage powder') || hasMove(p, 'follow me'),
      );
      const setupMoves = ['iron defense', 'swords dance', 'nasty plot', 'calm mind', 'dragon dance', 'quiver dance', 'belly drum', 'shell smash', 'coil', 'bulk up'];
      const setupUsers = team.filter(p =>
        setupMoves.some(m => hasMove(p, m)),
      );

      for (const redir of redirectors) {
        for (const sweeper of setupUsers) {
          if (redir.name === sweeper.name) continue;
          const redirMove = hasMove(redir, 'rage powder') ? 'Rage Powder' : 'Follow Me';
          const setupMove = setupMoves.find(m => hasMove(sweeper, m)) ?? '';
          const displaySetup = setupMove.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

          insights.push({
            type: 'redirection_setup',
            pokemonInvolved: [redir.name, sweeper.name],
            mechanicsUsed: [redirMove],
            movesRequired: [redirMove, displaySetup],
            explanation_ptBR: `Use ${redirMove} de ${redir.name} para redirecionar golpes de alvo único enquanto ${sweeper.name} configura ${displaySetup} com segurança.`,
            explanation_enUS: `Use ${redir.name}'s ${redirMove} to redirect single-target attacks while ${sweeper.name} safely sets up ${displaySetup}.`,
            verified: true,
            missingResources: [],
            impactScore: 85,
          });
        }
      }
      return insights;
    },
  },

  // ── Regra 3: Imunidade Cruzada (Levitate/Flying contra Ground) ──
  {
    id: 'immunity_coverage_ground',
    type: 'immunity_coverage',
    analyze(team, format) {
      const insights: TacticalInsight[] = [];
      const groundImmune = team.filter(p =>
        hasAbility(p, 'levitate', format) || hasType(p, 'flying', format),
      );
      const groundWeak = team.filter(p =>
        isWeakTo(p, 'ground', format) && !hasAbility(p, 'levitate', format) && !hasType(p, 'flying', format),
      );

      for (const immune of groundImmune) {
        for (const weak of groundWeak) {
          if (immune.name === weak.name) continue;
          const source = hasAbility(immune, 'levitate', format) ? 'Levitate' : 'tipo Flying';
          insights.push({
            type: 'immunity_coverage',
            pokemonInvolved: [immune.name, weak.name],
            mechanicsUsed: [source],
            movesRequired: [],
            explanation_ptBR: `A imunidade a Ground de ${immune.name} via ${source} permite posicionar ${weak.name} com menor risco de Earthquake.`,
            explanation_enUS: `${immune.name}'s Ground immunity via ${source} helps position ${weak.name} with reduced Earthquake risk.`,
            verified: true,
            missingResources: [],
            impactScore: 60,
          });
        }
      }
      return insights;
    },
  },

  // ── Regra 4: Conflito TR + Tailwind ──
  {
    id: 'speed_conflict_tr_tailwind',
    type: 'speed_conflict',
    analyze(team, _format) {
      const insights: TacticalInsight[] = [];
      const hasTR = team.some(p => hasMove(p, 'trick room'));
      const hasTailwind = team.some(p => hasMove(p, 'tailwind'));

      if (hasTR && hasTailwind) {
        const trSetter = team.find(p => hasMove(p, 'trick room'))!;
        const twSetter = team.find(p => hasMove(p, 'tailwind'))!;
        insights.push({
          type: 'speed_conflict',
          pokemonInvolved: [trSetter.name, twSetter.name],
          mechanicsUsed: ['Trick Room', 'Tailwind'],
          movesRequired: ['Trick Room', 'Tailwind'],
          explanation_ptBR: `Trick Room e Tailwind são controles de velocidade opostos. Use apenas um por partida conforme o matchup: Trick Room contra times rápidos, Tailwind contra times lentos.`,
          explanation_enUS: `Trick Room and Tailwind are opposing speed control. Use only one per game based on the matchup: Trick Room vs fast teams, Tailwind vs slow teams.`,
          verified: true,
          missingResources: [],
          impactScore: 55,
        });
      }
      return insights;
    },
  },

  // ── Regra 5: Fake Out + Setter ──
  {
    id: 'fake_out_setter',
    type: 'fake_out_setter',
    analyze(team, _format) {
      const insights: TacticalInsight[] = [];
      const fakeOutUsers = team.filter(p => hasMove(p, 'fake out'));
      const setterMoves = ['trick room', 'tailwind', 'psychic terrain', 'electric terrain', 'grassy terrain'];
      const setters = team.filter(p => setterMoves.some(m => hasMove(p, m)));

      for (const fo of fakeOutUsers) {
        for (const setter of setters) {
          if (fo.name === setter.name) continue;
          const setupMove = setterMoves.find(m => hasMove(setter, m)) ?? '';
          const displayMove = setupMove.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

          insights.push({
            type: 'fake_out_setter',
            pokemonInvolved: [fo.name, setter.name],
            mechanicsUsed: ['Fake Out'],
            movesRequired: ['Fake Out', displayMove],
            explanation_ptBR: `Use Fake Out de ${fo.name} no turno 1 para travar um oponente perigoso e garantir a ativação segura de ${displayMove} por ${setter.name}.`,
            explanation_enUS: `Use ${fo.name}'s Fake Out on turn 1 to flinch a dangerous opponent and guarantee ${setter.name}'s safe ${displayMove} setup.`,
            verified: true,
            missingResources: [],
            impactScore: 90,
          });
        }
      }
      return insights;
    },
  },

  // ── Regra 6: Hospitality + Pivot ──
  {
    id: 'ability_synergy_hospitality',
    type: 'ability_synergy',
    analyze(team, format) {
      const insights: TacticalInsight[] = [];
      const hospitalityUsers = team.filter(p => hasAbility(p, 'hospitality', format));

      if (hospitalityUsers.length === 0) return insights;

      const partners = team.filter(p => !hasAbility(p, 'hospitality', format));
      for (const host of hospitalityUsers) {
        for (const partner of partners) {
          insights.push({
            type: 'ability_synergy',
            pokemonInvolved: [host.name, partner.name],
            mechanicsUsed: ['Hospitality'],
            movesRequired: [],
            explanation_ptBR: `Trocar ${host.name} de volta ao campo ativa Hospitality, curando ${partner.name} em ~25% do HP máximo. Isso recompensa jogadas de pivot e reposicionamento.`,
            explanation_enUS: `Switching ${host.name} back in triggers Hospitality, healing ${partner.name} by ~25% max HP. This rewards pivot plays and repositioning.`,
            verified: true,
            missingResources: [],
            impactScore: 50,
          });
        }
      }
      // Limitar a 2 insights de Hospitality (parceiros mais relevantes)
      return insights.slice(0, 2);
    },
  },

  // ── Regra 7: Swift Swim sob Chuva ──
  {
    id: 'swift_swim_rain',
    type: 'swift_swim_rain',
    analyze(team, format) {
      const insights: TacticalInsight[] = [];
      const rainSetters = team.filter(p =>
        hasAbility(p, 'drizzle', format) || hasAbility(p, 'primordial sea', format),
      );
      const swiftSwimmers = team.filter(p => hasAbility(p, 'swift swim', format));

      for (const setter of rainSetters) {
        for (const swimmer of swiftSwimmers) {
          if (setter.name === swimmer.name) continue;
          insights.push({
            type: 'swift_swim_rain',
            pokemonInvolved: [setter.name, swimmer.name],
            mechanicsUsed: ['Drizzle', 'Swift Swim'],
            movesRequired: [],
            explanation_ptBR: `A chuva de ${setter.name} dobra a velocidade de ${swimmer.name} via Swift Swim. Se liderarem juntos, a pressão ofensiva é imediata; caso contrário, preserve-o no banco para entrar sob chuva.`,
            explanation_enUS: `${setter.name}'s rain doubles ${swimmer.name}'s speed via Swift Swim. If leading together, offensive pressure is immediate; otherwise, preserve it on the bench to switch in under rain.`,
            verified: true,
            missingResources: [],
            impactScore: 88,
          });
        }
      }
      return insights;
    },
  },

  // ── Regra 8: Pivot Lento sob TR (Volt Switch / U-turn) ──
  {
    id: 'slow_pivot_tr',
    type: 'slow_pivot',
    analyze(team, format) {
      const insights: TacticalInsight[] = [];
      const hasTR = team.some(p => hasMove(p, 'trick room'));
      if (!hasTR) return insights;

      const slowPivots = team.filter(p => {
        const speed = getBaseSpeed(p, format);
        const hasPivotMove = hasMove(p, 'volt switch') || hasMove(p, 'u-turn') || hasMove(p, 'flip turn') || hasMove(p, 'parting shot');
        return speed <= 65 && hasPivotMove;
      });

      for (const pivot of slowPivots) {
        const pivotMove = hasMove(pivot, 'volt switch') ? 'Volt Switch'
          : hasMove(pivot, 'u-turn') ? 'U-turn'
          : hasMove(pivot, 'flip turn') ? 'Flip Turn'
          : 'Parting Shot';

        insights.push({
          type: 'slow_pivot',
          pokemonInvolved: [pivot.name],
          mechanicsUsed: [pivotMove, 'Trick Room'],
          movesRequired: [pivotMove, 'Trick Room'],
          explanation_ptBR: `${pivotMove} de ${pivot.name} sob Trick Room funciona como pivot lento: ele ataca, sai por último e traz o próximo parceiro de forma totalmente segura.`,
          explanation_enUS: `${pivot.name}'s ${pivotMove} under Trick Room works as a slow pivot: it attacks, switches last, and brings in the next partner safely.`,
          verified: true,
          missingResources: [],
          impactScore: 72,
        });
      }
      return insights;
    },
  },

  // ── Regra 9: Wide Guard Protege Contra Spread ──
  {
    id: 'wide_guard_cover',
    type: 'wide_guard_cover',
    analyze(team, format) {
      const insights: TacticalInsight[] = [];
      const wideGuardUsers = team.filter(p => hasMove(p, 'wide guard'));
      if (wideGuardUsers.length === 0) return insights;

      // Pokémon fracos a golpes spread comuns (Rock Slide, Earthquake, Heat Wave)
      const spreadVulnerable = team.filter(p =>
        isWeakTo(p, 'ground', format) || isWeakTo(p, 'fire', format) || hasType(p, 'ice', format) || hasType(p, 'bug', format),
      );

      for (const guard of wideGuardUsers) {
        for (const target of spreadVulnerable) {
          if (guard.name === target.name) continue;
          insights.push({
            type: 'wide_guard_cover',
            pokemonInvolved: [guard.name, target.name],
            mechanicsUsed: ['Wide Guard'],
            movesRequired: ['Wide Guard'],
            explanation_ptBR: `Wide Guard de ${guard.name} bloqueia Rock Slide, Earthquake, Heat Wave e outros golpes em área que ameaçam ${target.name}.`,
            explanation_enUS: `${guard.name}'s Wide Guard blocks Rock Slide, Earthquake, Heat Wave and other spread moves threatening ${target.name}.`,
            verified: true,
            missingResources: [],
            impactScore: 65,
          });
        }
      }
      // Limitar a 2 para não poluir
      return insights.slice(0, 2);
    },
  },

  // ── Regra 10: Body Press + Iron Defense como Win Condition ──
  {
    id: 'body_press_setup',
    type: 'body_press_setup',
    analyze(team, _format) {
      const insights: TacticalInsight[] = [];
      const setupSweepers = team.filter(p =>
        hasMove(p, 'iron defense') && hasMove(p, 'body press'),
      );

      for (const sweeper of setupSweepers) {
        const missing: string[] = [];
        if (!hasMove(sweeper, 'iron defense')) missing.push('Iron Defense');
        if (!hasMove(sweeper, 'body press')) missing.push('Body Press');

        insights.push({
          type: 'body_press_setup',
          pokemonInvolved: [sweeper.name],
          mechanicsUsed: ['Iron Defense', 'Body Press'],
          movesRequired: ['Iron Defense', 'Body Press'],
          explanation_ptBR: `${sweeper.name} com Iron Defense + Body Press funciona como condição de vitória defensiva: após um boost, Body Press escala com a defesa aumentada, tornando-se devastador contra times físicos.`,
          explanation_enUS: `${sweeper.name} with Iron Defense + Body Press is a defensive win condition: after boosting, Body Press scales with boosted defense, becoming devastating against physical teams.`,
          verified: missing.length === 0,
          missingResources: missing,
          impactScore: 80,
        });
      }
      return insights;
    },
  },

  // ── Regra 11: Sinergia Híbrida Rain Room (Chuva + Trick Room) ──
  {
    id: 'hybrid_rain_room',
    type: 'hybrid_axis_synergy',
    analyze(team, format) {
      if (team.length <= 4) return [];
      const insights: TacticalInsight[] = [];
      const rainSetters = team.filter(p =>
        hasAbility(p, 'drizzle', format) || hasAbility(p, 'primordial sea', format),
      );
      const trSetters = team.filter(p => hasMove(p, 'trick room'));

      if (rainSetters.length > 0 && trSetters.length > 0) {
        const rainSetter = rainSetters[0];
        const trSetter = trSetters[0];
        const rainAbusers = team.filter(p => hasAbility(p, 'swift swim', format) || hasMove(p, 'wave crash') || hasMove(p, 'liquidation'));
        const slowMon = team.filter(p => getBaseSpeed(p, format) <= 60);

        const missing: string[] = [];
        if (rainAbusers.length === 0) {
          missing.push(format === 'pt-BR' ? 'Atacante de Chuva (Swift Swim ou golpes de água)' : 'Rain Sweeper (Swift Swim or Water moves)');
        }
        if (slowMon.length < 2) {
          missing.push(format === 'pt-BR' ? 'Atacantes Lentos (Speed <= 60)' : 'Slow Attackers (Speed <= 60)');
        }

        insights.push({
          type: 'hybrid_axis_synergy',
          pokemonInvolved: [rainSetter.name, trSetter.name],
          mechanicsUsed: ['Drizzle', 'Trick Room'],
          movesRequired: ['Trick Room'],
          explanation_ptBR: `Sinergia Híbrida (Rain Room): Seu time combina o ritmo veloz da chuva com o controle de espaço do Trick Room. Use a chuva de ${rainSetter.name} para pressionar o oponente e, contra times ultra velozes, ative o Trick Room com ${trSetter.name}.`,
          explanation_enUS: `Hybrid Synergy (Rain Room): Your team blends fast rain offense with Trick Room. Use ${rainSetter.name}'s rain to apply offensive pressure, or set Trick Room via ${trSetter.name} against high-speed teams.`,
          verified: missing.length === 0,
          missingResources: missing,
          impactScore: 95,
        });
      }
      return insights;
    },
  },

  // ── Regra 12: Sinergia Híbrida Sun Room (Sol + Trick Room) ──
  {
    id: 'hybrid_sun_room',
    type: 'hybrid_axis_synergy',
    analyze(team, format) {
      if (team.length <= 4) return [];
      const insights: TacticalInsight[] = [];
      const sunSetters = team.filter(p =>
        hasAbility(p, 'drought', format) || hasAbility(p, 'orichalcum pulse', format),
      );
      const trSetters = team.filter(p => hasMove(p, 'trick room'));

      if (sunSetters.length > 0 && trSetters.length > 0) {
        const sunSetter = sunSetters[0];
        const trSetter = trSetters[0];
        const sunAbusers = team.filter(p => hasAbility(p, 'chlorophyll', format) || hasMove(p, 'heat wave') || hasMove(p, 'solar beam'));
        const slowMon = team.filter(p => getBaseSpeed(p, format) <= 60);

        const missing: string[] = [];
        if (sunAbusers.length === 0) {
          missing.push(format === 'pt-BR' ? 'Atacante de Sol (Chlorophyll ou golpes Fire/Solar Beam)' : 'Sun Sweeper (Chlorophyll or Fire/Solar Beam moves)');
        }
        if (slowMon.length < 2) {
          missing.push(format === 'pt-BR' ? 'Atacantes Lentos (Speed <= 60)' : 'Slow Attackers (Speed <= 60)');
        }

        insights.push({
          type: 'hybrid_axis_synergy',
          pokemonInvolved: [sunSetter.name, trSetter.name],
          mechanicsUsed: ['Drought', 'Trick Room'],
          movesRequired: ['Trick Room'],
          explanation_ptBR: `Sinergia Híbrida (Sun Room): Seu time conecta o sol de ${sunSetter.name} para ativar sweepers rápidos e, se necessário, inverte a velocidade sob o Trick Room de ${trSetter.name} para abusadores pesados.`,
          explanation_enUS: `Hybrid Synergy (Sun Room): Your team connects ${sunSetter.name}'s sun to trigger fast sweepers, and switches to Trick Room via ${trSetter.name} for heavy attackers when needed.`,
          verified: missing.length === 0,
          missingResources: missing,
          impactScore: 92,
        });
      }
      return insights;
    },
  },

  // ── Regra 13: Sinergia Híbrida Sand Room (Areia + Trick Room) ──
  {
    id: 'hybrid_sand_room',
    type: 'hybrid_axis_synergy',
    analyze(team, format) {
      if (team.length <= 4) return [];
      const insights: TacticalInsight[] = [];
      const sandSetters = team.filter(p =>
        hasAbility(p, 'sand stream', format) || hasAbility(p, 'sand spit', format),
      );
      const trSetters = team.filter(p => hasMove(p, 'trick room'));

      if (sandSetters.length > 0 && trSetters.length > 0) {
        const sandSetter = sandSetters[0];
        const trSetter = trSetters[0];
        const sandAbusers = team.filter(p =>
          hasAbility(p, 'sand rush', format) ||
          hasAbility(p, 'sand force', format) ||
          hasAbility(p, 'sand veil', format) ||
          hasType(p, 'rock', format) ||
          hasType(p, 'ground', format) ||
          hasType(p, 'steel', format),
        );
        const slowMon = team.filter(p => getBaseSpeed(p, format) <= 60);

        const missing: string[] = [];
        if (sandAbusers.length === 0) {
          missing.push(format === 'pt-BR' ? 'Atacante de Areia (Rock/Ground/Steel ou Sand Rush)' : 'Sand Sweeper (Rock/Ground/Steel or Sand Rush)');
        }
        if (slowMon.length < 2) {
          missing.push(format === 'pt-BR' ? 'Atacantes Lentos (Speed <= 60)' : 'Slow Attackers (Speed <= 60)');
        }

        insights.push({
          type: 'hybrid_axis_synergy',
          pokemonInvolved: [sandSetter.name, trSetter.name],
          mechanicsUsed: ['Sand Stream', 'Trick Room'],
          movesRequired: ['Trick Room'],
          explanation_ptBR: `Sinergia Híbrida (Sand Room): A areia de ${sandSetter.name} concede +50% de Sp. Def para Rock-types e ativa atacantes de areia, enquanto o Trick Room de ${trSetter.name} inverte a velocidade para sweepers lentos.`,
          explanation_enUS: `Hybrid Synergy (Sand Room): ${sandSetter.name}'s sandstorm grants +50% Sp. Def to Rock-types, while ${trSetter.name}'s Trick Room reverses speed for slow sweepers.`,
          verified: missing.length === 0,
          missingResources: missing,
          impactScore: 90,
        });
      }
      return insights;
    },
  },

  // ── Regra 14: Sinergia Híbrida Snow Room (Neve + Trick Room) ──
  {
    id: 'hybrid_snow_room',
    type: 'hybrid_axis_synergy',
    analyze(team, format) {
      if (team.length <= 4) return [];
      const insights: TacticalInsight[] = [];
      const snowSetters = team.filter(p =>
        hasAbility(p, 'snow warning', format),
      );
      const trSetters = team.filter(p => hasMove(p, 'trick room'));

      if (snowSetters.length > 0 && trSetters.length > 0) {
        const snowSetter = snowSetters[0];
        const trSetter = trSetters[0];
        const snowAbusers = team.filter(p =>
          hasAbility(p, 'slush rush', format) ||
          hasMove(p, 'blizzard') ||
          hasType(p, 'ice', format),
        );
        const slowMon = team.filter(p => getBaseSpeed(p, format) <= 60);

        const missing: string[] = [];
        if (snowAbusers.length === 0) {
          missing.push(format === 'pt-BR' ? 'Atacante de Neve (Ice-type, Slush Rush ou Blizzard)' : 'Snow Sweeper (Ice-type, Slush Rush or Blizzard)');
        }
        if (slowMon.length < 2) {
          missing.push(format === 'pt-BR' ? 'Atacantes Lentos (Speed <= 60)' : 'Slow Attackers (Speed <= 60)');
        }

        insights.push({
          type: 'hybrid_axis_synergy',
          pokemonInvolved: [snowSetter.name, trSetter.name],
          mechanicsUsed: ['Snow Warning', 'Trick Room'],
          movesRequired: ['Trick Room'],
          explanation_ptBR: `Sinergia Híbrida (Snow Room): A neve de ${snowSetter.name} aumenta a Defense de Ice-types em 50% e garante acerto para Blizzard, enquanto o Trick Room de ${trSetter.name} controla o ritmo de adversários velozes.`,
          explanation_enUS: `Hybrid Synergy (Snow Room): ${snowSetter.name}'s snow boosts Ice-types Defense by 50% and bypasses Blizzard check, while ${trSetter.name}'s Trick Room controls faster opponents.`,
          verified: missing.length === 0,
          missingResources: missing,
          impactScore: 90,
        });
      }
      return insights;
    },
  },

  // ── Regra 15: Sinergia Híbrida Psyspam Room (Psychic Terrain + Trick Room) ──
  {
    id: 'hybrid_psyspam_room',
    type: 'hybrid_axis_synergy',
    analyze(team, format) {
      if (team.length <= 4) return [];
      const insights: TacticalInsight[] = [];
      const terrainSetters = team.filter(p =>
        hasAbility(p, 'psychic surge', format),
      );
      const trSetters = team.filter(p => hasMove(p, 'trick room'));

      if (terrainSetters.length > 0 && trSetters.length > 0) {
        const setter = terrainSetters[0];
        const trSetter = trSetters[0];
        const abusers = team.filter(p => hasMove(p, 'expanding force'));
        const slowMon = team.filter(p => getBaseSpeed(p, format) <= 60);

        const missing: string[] = [];
        if (abusers.length === 0) {
          missing.push(format === 'pt-BR' ? 'Expanding Force' : 'Expanding Force');
        }
        if (slowMon.length < 2) {
          missing.push(format === 'pt-BR' ? 'Atacantes Lentos (Speed <= 60)' : 'Slow Attackers (Speed <= 60)');
        }

        insights.push({
          type: 'hybrid_axis_synergy',
          pokemonInvolved: [setter.name, trSetter.name],
          mechanicsUsed: ['Psychic Surge', 'Trick Room'],
          movesRequired: ['Trick Room', 'Expanding Force'],
          explanation_ptBR: `Sinergia Híbrida (Psyspam Room): O campo psíquico de ${setter.name} bloqueia golpes de prioridade (como Fake Out, Sucker Punch) e aumenta o dano de Expanding Force, funcionando em perfeita harmonia sob o Trick Room de ${trSetter.name}.`,
          explanation_enUS: `Hybrid Synergy (Psyspam Room): ${setter.name}'s Psychic Terrain blocks priority moves (like Fake Out, Sucker Punch) and boosts Expanding Force, synergizing perfectly under ${trSetter.name}'s Trick Room.`,
          verified: missing.length === 0,
          missingResources: missing,
          impactScore: 94,
        });
      }
      return insights;
    },
  },

  // ── Regra 16: Sinergia Híbrida Perish Trap + Rain (Shadow Tag + Rain) ──
  {
    id: 'hybrid_perish_trap_rain',
    type: 'hybrid_axis_synergy',
    analyze(team, format) {
      if (team.length <= 4) return [];
      const insights: TacticalInsight[] = [];
      const taggers = team.filter(p =>
        hasAbility(p, 'shadow tag', format),
      );
      const rainSetters = team.filter(p =>
        hasAbility(p, 'drizzle', format) || hasAbility(p, 'primordial sea', format),
      );

      if (taggers.length > 0 && rainSetters.length > 0) {
        const tagger = taggers[0];
        const rainSetter = rainSetters[0];
        const hasPerishSong = team.some(p => hasMove(p, 'perish song'));

        const missing: string[] = [];
        if (!hasPerishSong) {
          missing.push(format === 'pt-BR' ? 'Golpe Perish Song' : 'Perish Song move');
        }

        insights.push({
          type: 'hybrid_axis_synergy',
          pokemonInvolved: [tagger.name, rainSetter.name],
          mechanicsUsed: ['Shadow Tag', 'Drizzle'],
          movesRequired: ['Perish Song'],
          explanation_ptBR: `Sinergia Híbrida (Perish Trap Rain): Shadow Tag de ${tagger.name} impede que o oponente escape da contagem de Perish Song, enquanto a chuva de ${rainSetter.name} mitiga o dano Fire recebido e fortalece a defesa e pivot do time.`,
          explanation_enUS: `Hybrid Synergy (Perish Trap Rain): ${tagger.name}'s Shadow Tag traps opponents during Perish Song count, while ${rainSetter.name}'s rain mitigates Fire damage and supports pivot plays.`,
          verified: missing.length === 0,
          missingResources: missing,
          impactScore: 93,
        });
      }
      return insights;
    },
  },

  // ── Regra 17: Sinergia Híbrida Tailwind + Trick Room (Semiroom) ──
  {
    id: 'hybrid_tailwind_tr',
    type: 'hybrid_axis_synergy',
    analyze(team, format) {
      if (team.length <= 4) return [];
      const insights: TacticalInsight[] = [];
      const twSetters = team.filter(p => hasMove(p, 'tailwind'));
      const trSetters = team.filter(p => hasMove(p, 'trick room'));

      if (twSetters.length > 0 && trSetters.length > 0) {
        const twSetter = twSetters[0];
        const trSetter = trSetters[0];
        const slowMon = team.filter(p => getBaseSpeed(p, format) <= 60);
        const fastMon = team.filter(p => getBaseSpeed(p, format) >= 75);

        const missing: string[] = [];
        if (slowMon.length === 0) {
          missing.push(format === 'pt-BR' ? 'Atacante Lento para Trick Room' : 'Slow Attacker for Trick Room');
        }
        if (fastMon.length === 0) {
          missing.push(format === 'pt-BR' ? 'Atacante Rápido para Tailwind' : 'Fast Attacker for Tailwind');
        }

        insights.push({
          type: 'hybrid_axis_synergy',
          pokemonInvolved: [twSetter.name, trSetter.name],
          mechanicsUsed: ['Tailwind', 'Trick Room'],
          movesRequired: ['Tailwind', 'Trick Room'],
          explanation_ptBR: `Sinergia Híbrida (Semiroom): Seu time possui flexibilidade total de velocidade. Use o Tailwind de ${twSetter.name} contra times lentos e mude para o Trick Room de ${trSetter.name} contra oponentes rápidos.`,
          explanation_enUS: `Hybrid Synergy (Semiroom): Your team has total speed flexibility. Use ${twSetter.name}'s Tailwind against slow teams and shift to ${trSetter.name}'s Trick Room against fast matchups.`,
          verified: missing.length === 0,
          missingResources: missing,
          impactScore: 96,
        });
      }
      return insights;
    },
  },

  // ── Regra 18: Sinergia Híbrida Sun + Tailwind ──
  {
    id: 'hybrid_sun_tailwind',
    type: 'hybrid_axis_synergy',
    analyze(team, format) {
      if (team.length <= 4) return [];
      const insights: TacticalInsight[] = [];
      const sunSetters = team.filter(p =>
        hasAbility(p, 'drought', format) || hasAbility(p, 'orichalcum pulse', format),
      );
      const twSetters = team.filter(p => hasMove(p, 'tailwind'));

      if (sunSetters.length > 0 && twSetters.length > 0) {
        const sunSetter = sunSetters[0];
        const twSetter = twSetters[0];
        const sunAbusers = team.filter(p => hasAbility(p, 'chlorophyll', format) || hasMove(p, 'heat wave') || hasMove(p, 'solar beam'));

        const missing: string[] = [];
        if (sunAbusers.length === 0) {
          missing.push(format === 'pt-BR' ? 'Abusador de Sol' : 'Sun Abuser');
        }

        insights.push({
          type: 'hybrid_axis_synergy',
          pokemonInvolved: [sunSetter.name, twSetter.name],
          mechanicsUsed: ['Drought', 'Tailwind'],
          movesRequired: ['Tailwind'],
          explanation_ptBR: `Sinergia Híbrida (Sun Tailwind): Combina o Tailwind de ${twSetter.name} com o bônus de poder de golpes Fire sob o sol de ${sunSetter.name}, estabelecendo pressão ofensiva devastadora nos turnos iniciais.`,
          explanation_enUS: `Hybrid Synergy (Sun Tailwind): Combines ${twSetter.name}'s Tailwind with sun-boosted Fire damage from ${sunSetter.name}, establishing devastating turn-1 pressure.`,
          verified: missing.length === 0,
          missingResources: missing,
          impactScore: 88,
        });
      }
      return insights;
    },
  },

  // ── Regra 19: Sinergia Híbrida Rain + Tailwind ──
  {
    id: 'hybrid_rain_tailwind',
    type: 'hybrid_axis_synergy',
    analyze(team, format) {
      if (team.length <= 4) return [];
      const insights: TacticalInsight[] = [];
      const rainSetters = team.filter(p =>
        hasAbility(p, 'drizzle', format) || hasAbility(p, 'primordial sea', format),
      );
      const twSetters = team.filter(p => hasMove(p, 'tailwind'));

      if (rainSetters.length > 0 && twSetters.length > 0) {
        const rainSetter = rainSetters[0];
        const twSetter = twSetters[0];
        const rainAbusers = team.filter(p => hasAbility(p, 'swift swim', format) || hasMove(p, 'wave crash') || hasMove(p, 'liquidation'));

        const missing: string[] = [];
        if (rainAbusers.length === 0) {
          missing.push(format === 'pt-BR' ? 'Abusador de Chuva' : 'Rain Abuser');
        }

        insights.push({
          type: 'hybrid_axis_synergy',
          pokemonInvolved: [rainSetter.name, twSetter.name],
          mechanicsUsed: ['Drizzle', 'Tailwind'],
          movesRequired: ['Tailwind'],
          explanation_ptBR: `Sinergia Híbrida (Rain Tailwind): Acumula o controle de velocidade do Tailwind de ${twSetter.name} com a amplificação de dano Water sob a chuva de ${rainSetter.name}, ideal para quebrar defesas inimigas rapidamente.`,
          explanation_enUS: `Hybrid Synergy (Rain Tailwind): Stacks speed control from ${twSetter.name}'s Tailwind with water-damage amplification under ${rainSetter.name}'s rain, ideal for breaking defenses.`,
          verified: missing.length === 0,
          missingResources: missing,
          impactScore: 88,
        });
      }
      return insights;
    },
  },
];

// ─── API Pública ───────────────────────────────────────────────────────────

/**
 * Analisa as interações táticas entre os membros de uma equipe.
 *
 * Executa todas as regras registradas e retorna os insights
 * ordenados por impacto tático (do mais importante ao menos).
 *
 * @param team - Array de PokemonData (normalmente 4 para um modo, ou 6 para o time completo)
 * @param format - ID do formato para resolução de variantes
 * @returns TacticalInsight[] ordenados por impactScore decrescente
 */
export function analyzeTacticalInteractions(
  team: PokemonData[],
  format: string,
  context: TacticalInteractionContext = {},
): TacticalInsight[] {
  const allInsights: TacticalInsight[] = [];
  const selectedNames = new Set(team.map(pokemon => pokemon.name));
  const lead = new Set(context.lead ?? []);
  const backline = new Set(context.backline ?? []);

  for (const rule of TACTICAL_RULES) {
    try {
      const ruleInsights = rule.analyze(team, format);
      allInsights.push(...ruleInsights);
    } catch {
      // Regra falhou silenciosamente — não interrompe o pipeline
    }
  }

  return allInsights
    .filter(insight => insight.pokemonInvolved.every(name => selectedNames.has(name)))
    .map(insight => {
      const allActive = insight.pokemonInvolved.every(name => lead.has(name));
      const allSelected = insight.pokemonInvolved.every(name => selectedNames.has(name));
      const requiresSwitch = allSelected && !allActive;
      const availability = allActive
        ? 'active-now' as const
        : insight.pokemonInvolved.some(name => backline.has(name))
          ? 'available-after-switch' as const
          : 'selected-but-inactive' as const;

      let explanation_ptBR = insight.explanation_ptBR;
      let explanation_enUS = insight.explanation_enUS;

      if (insight.type === 'swift_swim_rain' && insight.pokemonInvolved.length >= 2) {
        const [setter, swimmer] = insight.pokemonInvolved;
        if (allActive) {
          explanation_ptBR = `${setter} ativa a chuva na abertura e habilita imediatamente Swift Swim de ${swimmer}.`;
          explanation_enUS = `${setter} sets rain from the lead and immediately enables ${swimmer}'s Swift Swim.`;
        } else {
          explanation_ptBR = `${swimmer} está no banco e precisa entrar enquanto a chuva de ${setter} permanecer ativa; a pressão de Swift Swim não é imediata.`;
          explanation_enUS = `${swimmer} is on the bench and must switch in while ${setter}'s rain remains active; Swift Swim pressure is not immediate.`;
        }
      }

      if (insight.type === 'fake_out_setter' && !allActive) {
        return {
          ...insight,
          verified: false,
          missingResources: [...insight.missingResources, 'Os dois usuários precisam estar na lead no turno 1.'],
          availability,
          fieldRequirements: { mustBeActive: [...insight.pokemonInvolved], mustBeSelected: [...insight.pokemonInvolved] },
          timing: { earliestTurn: 1, requiresSwitch, immediateFromLead: false },
          reliabilityScore: 0,
          explanation_ptBR,
          explanation_enUS,
        };
      }

      if (insight.type === 'slow_pivot') {
        explanation_ptBR = explanation_ptBR.replace('traz o próximo parceiro de forma totalmente segura', 'pode facilitar a entrada do próximo parceiro com menor exposição, desde que o golpe seja executado e o usuário sobreviva');
        explanation_enUS = explanation_enUS.replace('brings in the next partner safely', 'can bring in the next partner with reduced exposure if the move executes and the user survives');
      }

      if (insight.type === 'ability_synergy') {
        explanation_ptBR = explanation_ptBR.replace('Isso recompensa jogadas de pivot e reposicionamento.', 'Isso recompensa reposicionamentos manuais; sem um golpe de pivot, a entrada não é automática.');
        explanation_enUS = explanation_enUS.replace('This rewards pivot plays and repositioning.', 'This rewards manual repositioning; without a pivot move, the entry is not automatic.');
      }

      return {
        ...insight,
        availability,
        fieldRequirements: {
          mustBeActive: allActive ? [...insight.pokemonInvolved] : [],
          mustBeSelected: [...insight.pokemonInvolved],
          requiredWeather: insight.type === 'swift_swim_rain' || insight.type === 'weather_defense' ? 'rain' : undefined,
        },
        timing: {
          earliestTurn: allActive ? 1 : 2,
          requiresSwitch,
          immediateFromLead: allActive,
        },
        reliabilityScore: allActive ? Math.min(90, insight.impactScore) : Math.min(70, insight.impactScore),
        explanation_ptBR,
        explanation_enUS,
      };
    })
    .sort((a, b) => (b.reliabilityScore ?? b.impactScore) - (a.reliabilityScore ?? a.impactScore))
    .slice(0, 8);
}

/**
 * Retorna a lista de regras registradas.
 * Útil para testes e debugging.
 */
export function getRegisteredRules(): TacticalRule[] {
  return [...TACTICAL_RULES];
}
