// src/equinox/vgc/LeadCapabilityAnalyzer.ts
// Analisador expandido de capacidades da lead dupla para o pipeline Build-Around-Lead.
// Detecta clima, controle de velocidade, proteção, pressão ofensiva, sinergias defensivas,
// funções ausentes, conflitos e valida a viabilidade mecânica da dupla.

import type {
  LeadCapabilityProfile,
  LeadWeatherCapability,
  LeadSpeedControl,
  LeadProtectionCapability,
  LeadOffensiveCapability,
  LeadDefensiveSynergy,
  LeadMissingRole,
  LeadConflict,
} from './LeadBuildTypes';
import type { PokemonData } from '../core/AnalysisContext';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { getDamageMultiplier } from '../utils/DamageMultiplier';

// ─── Helpers de normalização ──────────────────────────────────────────────────

/** Normaliza strings removendo tudo que não é alfanumérico em lowercase. */
const normalize = (v?: string): string =>
  String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Retorna o nome normalizado da habilidade do Pokémon, priorizando o campo direto. */
function getAbilityName(p: PokemonData, format: string): string {
  return normalize(
    p.ability || getVariant(p, format)?.abilities?.['0'] || '',
  );
}

/** Retorna a lista normalizada dos golpes do Pokémon. */
function getMoveNames(p: PokemonData): string[] {
  return (p.moves ?? []).map(m => normalize(m));
}

// ─── Mapeamentos de detecção ──────────────────────────────────────────────────

/** Habilidades que ativam clima e suas famílias. */
const WEATHER_ABILITIES: Record<string, LeadWeatherCapability['family']> = {
  drizzle: 'rain',
  primordialsea: 'rain',
  drought: 'sun',
  desolateland: 'sun',
  orichalcumpulse: 'sun',
  sandstream: 'sand',
  snowwarning: 'snow',
};

/** Golpes que dão controle de velocidade. */
const SPEED_CONTROL_MOVES: Record<string, LeadSpeedControl['type']> = {
  tailwind: 'tailwind',
  trickroom: 'trick_room',
  icywind: 'icy_wind',
  electroweb: 'electroweb',
  thunderwave: 'thunder_wave',
};

/** Habilidades que dobram velocidade sob clima. */
const SPEED_CONTROL_ABILITIES: Record<string, LeadSpeedControl['type']> = {
  swiftswim: 'swift_swim',
  chlorophyll: 'chlorophyll',
};

/** Golpes de proteção e suporte de dupla. */
const PROTECTION_MOVES: Record<string, LeadProtectionCapability['type']> = {
  wideguard: 'wide_guard',
  quickguard: 'quick_guard',
  fakeout: 'fake_out',
  followme: 'follow_me',
  ragepowder: 'rage_powder',
  allyswitch: 'ally_switch',
  protect: 'protect',
};

/** Golpes spread (atingem múltiplos alvos). */
const SPREAD_MOVES: Set<string> = new Set([
  'rockslide', 'earthquake', 'heatwave', 'muddywater',
  'blizzard', 'dazzlinggleam', 'snarl', 'hypervoice',
]);

/** Golpes de prioridade. */
const PRIORITY_MOVES: Set<string> = new Set([
  'aquajet', 'suckerpunch', 'extremespeed', 'bulletpunch',
  'grassyglide', 'machpunch', 'iceshard', 'shadowsneak',
]);

/** Habilidades que dão controle de velocidade sob areia/neve. */
const SAND_SNOW_ABILITIES: Record<string, LeadSpeedControl['type']> = {
  sandrush: 'swift_swim',   // Reutiliza o tipo para clima-speed
  slushrush: 'chlorophyll', // Idem – ambos são "dobram velocidade sob clima"
};

// ─── Mapeamento de tipos STAB para basePower estimado ─────────────────────────

/** Retorna um basePower genérico estimado para golpes de um tipo STAB. */
function estimateStabBasePower(type: string): number {
  const highPowerTypes: Record<string, number> = {
    fire: 90, water: 90, electric: 90, ice: 90, dragon: 90,
    fighting: 80, ground: 80, rock: 80, fairy: 80,
    ghost: 80, dark: 80, psychic: 80, steel: 80,
    flying: 80, poison: 80, grass: 80, bug: 70, normal: 80,
  };
  return highPowerTypes[type.toLowerCase()] ?? 75;
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Analisa as capacidades de uma dupla de lead, retornando um perfil detalhado
 * que mapeia clima, controle de velocidade, proteção, pressão ofensiva,
 * sinergias defensivas, funções ausentes, conflitos e validação mecânica.
 */
export function analyzeLeadCapabilities(
  first: PokemonData,
  second: PokemonData,
  format: string,
): LeadCapabilityProfile {
  const weather: LeadWeatherCapability[] = [];
  const speedControl: LeadSpeedControl[] = [];
  const protection: LeadProtectionCapability[] = [];
  const offensivePressure: LeadOffensiveCapability[] = [];
  const defensiveSynergies: LeadDefensiveSynergy[] = [];
  const missingRoles: LeadMissingRole[] = [];
  const conflicts: LeadConflict[] = [];
  const warnings: string[] = [];

  const pokemonPair: [PokemonData, PokemonData] = [first, second];

  // ─── 1. Clima ───────────────────────────────────────────────────────────────

  for (const p of pokemonPair) {
    const abilityKey = getAbilityName(p, format);
    const family = WEATHER_ABILITIES[abilityKey];
    if (family) {
      weather.push({
        family,
        setter: p.name,
        setterAbility: abilityKey,
      });
    }
  }

  // ─── 2. Controle de velocidade ──────────────────────────────────────────────

  for (const p of pokemonPair) {
    const moves = getMoveNames(p);
    const abilityKey = getAbilityName(p, format);

    // Golpes de speed control
    for (const move of moves) {
      const scType = SPEED_CONTROL_MOVES[move];
      if (scType) {
        speedControl.push({
          type: scType,
          source: p.name,
          move,
        });
      }
    }

    // Habilidades de speed control (Swift Swim, Chlorophyll)
    const scAbilityType = SPEED_CONTROL_ABILITIES[abilityKey];
    if (scAbilityType) {
      speedControl.push({
        type: scAbilityType,
        source: p.name,
        ability: abilityKey,
      });
    }

    // Sand Rush / Slush Rush
    const sandSnowType = SAND_SNOW_ABILITIES[abilityKey];
    if (sandSnowType) {
      speedControl.push({
        type: sandSnowType,
        source: p.name,
        ability: abilityKey,
      });
    }
  }

  // ─── 3. Proteção e suporte ──────────────────────────────────────────────────

  for (const p of pokemonPair) {
    const moves = getMoveNames(p);
    for (const move of moves) {
      const protType = PROTECTION_MOVES[move];
      if (protType) {
        protection.push({
          type: protType,
          source: p.name,
          move,
        });
      }
    }
  }

  // ─── 4. Pressão ofensiva ────────────────────────────────────────────────────

  for (const p of pokemonPair) {
    const types = getPokemonTypes(p, format).map(t => t.toLowerCase());
    const moves = getMoveNames(p);

    // STAB types
    for (const type of types) {
      offensivePressure.push({
        type: `stab_${type}`,
        source: p.name,
        stab: true,
        spread: false,
        priority: false,
        basePower: estimateStabBasePower(type),
      });
    }

    // Spread moves
    for (const move of moves) {
      if (SPREAD_MOVES.has(move)) {
        offensivePressure.push({
          type: `spread_${move}`,
          source: p.name,
          stab: false, // Simplificação – checagem STAB exata requer mapeamento move→tipo
          spread: true,
          priority: false,
          basePower: 80,
        });
      }
    }

    // Priority moves
    for (const move of moves) {
      if (PRIORITY_MOVES.has(move)) {
        offensivePressure.push({
          type: `priority_${move}`,
          source: p.name,
          stab: false,
          spread: false,
          priority: true,
          basePower: 40,
        });
      }
    }
  }

  // ─── 5. Sinergias defensivas ────────────────────────────────────────────────

  const firstTypes = getPokemonTypes(first, format).map(t => t.toLowerCase());
  const secondTypes = getPokemonTypes(second, format).map(t => t.toLowerCase());
  const firstAbility = getAbilityName(first, format);
  const secondAbility = getAbilityName(second, format);

  // Imunidade a Ground (tipo Flying ou Levitate)
  if (firstTypes.includes('flying') || firstAbility === 'levitate') {
    defensiveSynergies.push({
      description: `${first.name} é imune a Ground, protegendo contra Earthquake do parceiro.`,
      beneficiary: first.name,
      mechanism: 'type_immunity',
    });
  }
  if (secondTypes.includes('flying') || secondAbility === 'levitate') {
    defensiveSynergies.push({
      description: `${second.name} é imune a Ground, protegendo contra Earthquake do parceiro.`,
      beneficiary: second.name,
      mechanism: 'type_immunity',
    });
  }

  // Imunidade a Water (Water Absorb, Storm Drain, Dry Skin)
  const waterImmuneAbilities = new Set(['waterabsorb', 'stormdrain', 'dryskin']);
  if (waterImmuneAbilities.has(firstAbility)) {
    defensiveSynergies.push({
      description: `${first.name} absorve golpes Water, protegendo contra ataques de água direcionados.`,
      beneficiary: first.name,
      mechanism: 'ability_immunity',
    });
  }
  if (waterImmuneAbilities.has(secondAbility)) {
    defensiveSynergies.push({
      description: `${second.name} absorve golpes Water, protegendo contra ataques de água direcionados.`,
      beneficiary: second.name,
      mechanism: 'ability_immunity',
    });
  }

  // Redução por clima: Chuva reduz Fire
  const hasRain = weather.some(w => w.family === 'rain');
  if (hasRain) {
    if (getDamageMultiplier(firstTypes, 'Fire') >= 2.0) {
      defensiveSynergies.push({
        description: `Chuva reduz dano Fire contra ${first.name}, mitigando sua fraqueza.`,
        beneficiary: first.name,
        mechanism: 'weather_reduction',
      });
    }
    if (getDamageMultiplier(secondTypes, 'Fire') >= 2.0) {
      defensiveSynergies.push({
        description: `Chuva reduz dano Fire contra ${second.name}, mitigando sua fraqueza.`,
        beneficiary: second.name,
        mechanism: 'weather_reduction',
      });
    }
  }

  // Redução por clima: Sol reduz Water
  const hasSun = weather.some(w => w.family === 'sun');
  if (hasSun) {
    if (getDamageMultiplier(firstTypes, 'Water') >= 2.0) {
      defensiveSynergies.push({
        description: `Sol reduz dano Water contra ${first.name}, mitigando sua fraqueza.`,
        beneficiary: first.name,
        mechanism: 'weather_reduction',
      });
    }
    if (getDamageMultiplier(secondTypes, 'Water') >= 2.0) {
      defensiveSynergies.push({
        description: `Sol reduz dano Water contra ${second.name}, mitigando sua fraqueza.`,
        beneficiary: second.name,
        mechanism: 'weather_reduction',
      });
    }
  }

  // Resistências cruzadas: cada tipo de um cobre fraqueza do outro
  const ALL_TYPES = [
    'normal', 'fire', 'water', 'electric', 'grass', 'ice',
    'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
    'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
  ];

  for (const atkType of ALL_TYPES) {
    const firstMult = getDamageMultiplier(firstTypes, atkType);
    const secondMult = getDamageMultiplier(secondTypes, atkType);

    // Primeiro é fraco, segundo resiste (ou vice-versa)
    if (firstMult >= 2.0 && secondMult <= 0.5) {
      defensiveSynergies.push({
        description: `${second.name} resiste ${atkType}, cobrindo a fraqueza de ${first.name}.`,
        beneficiary: first.name,
        mechanism: 'cross_resistance',
      });
    }
    if (secondMult >= 2.0 && firstMult <= 0.5) {
      defensiveSynergies.push({
        description: `${first.name} resiste ${atkType}, cobrindo a fraqueza de ${second.name}.`,
        beneficiary: second.name,
        mechanism: 'cross_resistance',
      });
    }
  }

  // ─── 6. Funções ausentes ────────────────────────────────────────────────────

  const hasRedirection = protection.some(
    p => p.type === 'follow_me' || p.type === 'rage_powder',
  );
  const hasFakeOut = protection.some(p => p.type === 'fake_out');
  const hasTrickRoom = speedControl.some(s => s.type === 'trick_room');
  const hasSecondarySpeedControl = speedControl.some(
    s => s.type === 'icy_wind' || s.type === 'electroweb' || s.type === 'thunder_wave',
  );

  if (!hasRedirection) {
    missingRoles.push({
      role: 'redirection',
      priority: 'important',
      reason: 'Lead não possui Follow Me ou Rage Powder para proteger setups.',
    });
  }

  if (!hasFakeOut) {
    missingRoles.push({
      role: 'fake_out',
      priority: 'important',
      reason: 'Lead não possui Fake Out para controle de turno 1.',
    });
  }

  if (!hasTrickRoom && speedControl.length === 0) {
    missingRoles.push({
      role: 'trick_room_setter',
      priority: 'nice_to_have',
      reason: 'Time não possui opção de Trick Room para flexibilidade contra times lentos.',
    });
  }

  if (!hasSecondarySpeedControl) {
    missingRoles.push({
      role: 'secondary_speed_control',
      priority: 'nice_to_have',
      reason: 'Lead não possui controle de velocidade secundário (Icy Wind, Electroweb, Thunder Wave).',
    });
  }

  // Cobertura elétrica: verifica se algum membro da lead é fraco a Electric
  const eitherWeakToElectric =
    getDamageMultiplier(firstTypes, 'Electric') >= 2.0 ||
    getDamageMultiplier(secondTypes, 'Electric') >= 2.0;
  if (eitherWeakToElectric) {
    const hasGroundType =
      firstTypes.includes('ground') || secondTypes.includes('ground');
    if (!hasGroundType) {
      missingRoles.push({
        role: 'electric_answer',
        priority: 'important',
        reason: 'Lead tem fraqueza a Electric sem cobertura Ground.',
      });
    }
  }

  // Imunidade a Ground
  const hasGroundImmunity =
    firstTypes.includes('flying') ||
    secondTypes.includes('flying') ||
    firstAbility === 'levitate' ||
    secondAbility === 'levitate';
  if (!hasGroundImmunity) {
    missingRoles.push({
      role: 'ground_immunity',
      priority: 'nice_to_have',
      reason: 'Nenhum Pokémon da lead é imune a Ground.',
    });
  }

  // ─── 7. Conflitos ──────────────────────────────────────────────────────────

  // Climas conflitantes
  if (weather.length >= 2) {
    const families = new Set(weather.map(w => w.family));
    if (families.size >= 2) {
      conflicts.push({
        description: `Climas conflitantes: ${weather.map(w => `${w.setter} (${w.setterAbility})`).join(' vs ')}. O último a entrar sobrescreve o clima anterior.`,
        severity: 'hard',
        pokemonInvolved: weather.map(w => w.setter),
      });
    }
  }

  // Intimidate duplo
  if (firstAbility === 'intimidate' && secondAbility === 'intimidate') {
    conflicts.push({
      description: 'Intimidate duplo: redundante e desperdiça potencial de habilidade.',
      severity: 'soft',
      pokemonInvolved: [first.name, second.name],
    });
  }

  // Terrenos que bloqueiam Sleep (Electric Terrain, Misty Terrain via habilidades)
  const terrainAbilities = new Set([
    'electricsurge', 'psychicsurge', 'grassysurge', 'mistysurge',
  ]);
  const firstHasTerrain = terrainAbilities.has(firstAbility);
  const secondHasTerrain = terrainAbilities.has(secondAbility);
  if (firstHasTerrain && secondHasTerrain) {
    conflicts.push({
      description: `Terrenos conflitantes: ${first.name} (${firstAbility}) e ${second.name} (${secondAbility}) competem pela ativação de terreno.`,
      severity: 'hard',
      pokemonInvolved: [first.name, second.name],
    });
  }

  // Warning: Tailwind + Trick Room na mesma lead pode ser estranho
  const hasTailwind = speedControl.some(s => s.type === 'tailwind');
  if (hasTailwind && hasTrickRoom) {
    warnings.push(
      'Lead possui Tailwind e Trick Room simultaneamente. Apesar de flexível, pode diluir o foco da estratégia.',
    );
  }

  // ─── 8. Validação mecânica ──────────────────────────────────────────────────

  const hasHardConflict = conflicts.some(c => c.severity === 'hard');
  const mechanicallyValid = !hasHardConflict;

  // ─── Retorno ────────────────────────────────────────────────────────────────

  return {
    lead: [first.name, second.name],
    weather,
    speedControl,
    protection,
    offensivePressure,
    defensiveSynergies,
    missingRoles,
    conflicts,
    warnings,
    mechanicallyValid,
  };
}
