// src/equinox/vgc/LeadStrategyGenerator.ts
// Gerador de estratégias de lead para o pipeline Build-Around-Lead (Champions Doubles).
// Produz candidatas de estratégia baseadas no perfil de capacidades da lead dupla,
// garantindo que cada estratégia só seja gerada se as capacidades necessárias existirem.

import type {
  LeadCapabilityProfile,
  LeadStrategyCandidate,
  TurnOneOption,
  StrategyRoleRequirement,
} from './LeadBuildTypes';
import type { PokemonData } from '../core/AnalysisContext';

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Normaliza strings para comparação. */
const normalize = (v?: string): string =>
  String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Verifica se o Pokémon possui um determinado golpe. */
function hasMove(p: PokemonData, move: string): boolean {
  return (p.moves ?? []).some(m => normalize(m) === normalize(move));
}

/** Verifica se o Pokémon possui uma determinada habilidade. */
function hasAbility(p: PokemonData, ability: string): boolean {
  const pAbility = normalize(p.ability || '');
  return pAbility === normalize(ability);
}

/** Cria uma opção de turno 1 para um Pokémon. */
function turnOne(
  pokemonName: string,
  action: string,
  reasoning: string,
  target?: string,
): TurnOneOption {
  return { pokemonName, action, reasoning, ...(target ? { target } : {}) };
}

/** Cria um requisito de role. */
function roleReq(
  role: string,
  priority: StrategyRoleRequirement['priority'],
  weight: number,
  description: string,
): StrategyRoleRequirement {
  return { role, priority, weight, description };
}

// ─── Geradores de estratégia individuais ──────────────────────────────────────

/**
 * Gera estratégia de Chuva Ofensiva.
 * Somente se o perfil contiver clima Rain.
 */
function generateRainOffense(
  lead: [PokemonData, PokemonData],
  profile: LeadCapabilityProfile,
): LeadStrategyCandidate | null {
  if (!profile.weather.some(w => w.family === 'rain')) return null;

  const [first, second] = lead;
  const rainSetter = profile.weather.find(w => w.family === 'rain')!;
  const partner = rainSetter.setter === first.name ? second : first;
  const setter = rainSetter.setter === first.name ? first : second;

  const turnOneOptions: TurnOneOption[] = [];

  // Setter: Tailwind se disponível, senão ataca ou protege
  if (hasMove(setter, 'Tailwind')) {
    turnOneOptions.push(
      turnOne(setter.name, 'Tailwind', 'Dobra a velocidade do time inteiro sob chuva.'),
    );
  } else if (hasMove(setter, 'Protect')) {
    turnOneOptions.push(
      turnOne(setter.name, 'Protect', 'Garante turno seguro enquanto parceiro atua.'),
    );
  } else {
    // Setter ataca se não tem Tailwind nem Protect
    const attackMoves = (setter.moves ?? []).filter(
      m => !['protect', 'tailwind', 'trickroom'].includes(normalize(m)),
    );
    if (attackMoves.length > 0) {
      turnOneOptions.push(
        turnOne(setter.name, attackMoves[0], 'Pressão ofensiva imediata sob chuva.'),
      );
    }
  }

  // Parceiro: Protect ou ataque
  if (hasMove(partner, 'Protect')) {
    turnOneOptions.push(
      turnOne(partner.name, 'Protect', 'Garante turno seguro enquanto setup é ativado.'),
    );
  } else {
    const attackMoves = (partner.moves ?? []).filter(
      m => normalize(m) !== 'protect',
    );
    if (attackMoves.length > 0) {
      turnOneOptions.push(
        turnOne(partner.name, attackMoves[0], 'Pressão ofensiva enquanto chuva é estabelecida.'),
      );
    }
  }

  const requiredRoles: StrategyRoleRequirement[] = [
    roleReq('swift-swim-attacker', 'required', 30,
      'Abusador de Swift Swim para pressão ofensiva sob chuva.'),
    roleReq('water-breaker', 'required', 25,
      'Atacante Water para aproveitar o boost de STAB + chuva.'),
  ];

  const optionalRoles: StrategyRoleRequirement[] = [
    roleReq('electric-answer', 'preferred', 15,
      'Proteção contra Electric, fraqueza comum de times Water.'),
    roleReq('grass-answer', 'preferred', 15,
      'Cobertura contra Grass que resiste Water.'),
    roleReq('redirection', 'optional', 10,
      'Redirecionamento para proteger setups.'),
  ];

  // Verificar se o próprio parceiro cobre alguma role requerida
  const partnerAbility = normalize(partner.ability || '');
  const hasSwiftSwim = partnerAbility === 'swiftswim';

  // Score de viabilidade baseado na consistência
  let feasibility = 85;
  if (hasSwiftSwim) feasibility += 5;
  if (hasMove(setter, 'Tailwind')) feasibility += 3;
  if (profile.protection.some(p => p.type === 'fake_out')) feasibility += 2;
  feasibility = Math.min(100, feasibility);

  return {
    id: 'rain_offense',
    name: 'Chuva Ofensiva',
    objective: 'Chuva automática de Drizzle dobra a velocidade de abusadores Swift Swim e reduz dano Fire no time.',
    lead: [first.name, second.name],
    turnOneOptions,
    requiredRoles,
    optionalRoles,
    speedAxis: 'fast',
    contractValid: true,
    validationErrors: [],
    feasibilityScore: feasibility,
  };
}

/**
 * Gera estratégia de Sol Ofensivo.
 * Somente se o perfil contiver clima Sun.
 */
function generateSunOffense(
  lead: [PokemonData, PokemonData],
  profile: LeadCapabilityProfile,
): LeadStrategyCandidate | null {
  if (!profile.weather.some(w => w.family === 'sun')) return null;

  const [first, second] = lead;
  const sunSetter = profile.weather.find(w => w.family === 'sun')!;
  const setter = sunSetter.setter === first.name ? first : second;
  const partner = sunSetter.setter === first.name ? second : first;

  const turnOneOptions: TurnOneOption[] = [];

  if (hasMove(setter, 'Protect')) {
    turnOneOptions.push(
      turnOne(setter.name, 'Protect', 'Garante turno seguro e ativação do sol.'),
    );
  } else {
    const attackMoves = (setter.moves ?? []).filter(
      m => normalize(m) !== 'protect',
    );
    if (attackMoves.length > 0) {
      turnOneOptions.push(
        turnOne(setter.name, attackMoves[0], 'Pressão ofensiva imediata sob sol.'),
      );
    }
  }

  if (hasMove(partner, 'Protect')) {
    turnOneOptions.push(
      turnOne(partner.name, 'Protect', 'Garante posicionamento seguro no turno 1.'),
    );
  } else {
    const attackMoves = (partner.moves ?? []).filter(
      m => normalize(m) !== 'protect',
    );
    if (attackMoves.length > 0) {
      turnOneOptions.push(
        turnOne(partner.name, attackMoves[0], 'Pressão ofensiva aproveitando o sol.'),
      );
    }
  }

  return {
    id: 'sun_offense',
    name: 'Sol Ofensivo',
    objective: 'Sol automático potencializa golpes Fire em +50% e dobra velocidade de Chlorophyll, reduzindo dano Water no time.',
    lead: [first.name, second.name],
    turnOneOptions,
    requiredRoles: [
      roleReq('chlorophyll-attacker', 'required', 30,
        'Abusador de Chlorophyll para pressão ofensiva sob sol.'),
      roleReq('fire-breaker', 'required', 25,
        'Atacante Fire para aproveitar o boost de STAB + sol.'),
    ],
    optionalRoles: [
      roleReq('water-answer', 'preferred', 15,
        'Proteção contra Water, fraqueza de times Fire.'),
      roleReq('rock-answer', 'preferred', 15,
        'Cobertura contra Rock que resiste Fire.'),
      roleReq('redirection', 'optional', 10,
        'Redirecionamento para proteger setups.'),
    ],
    speedAxis: 'fast',
    contractValid: true,
    validationErrors: [],
    feasibilityScore: 88,
  };
}

/**
 * Gera estratégia de Sand Rush.
 * Somente se o perfil contiver clima Sand.
 */
function generateSandRush(
  lead: [PokemonData, PokemonData],
  profile: LeadCapabilityProfile,
): LeadStrategyCandidate | null {
  if (!profile.weather.some(w => w.family === 'sand')) return null;

  const [first, second] = lead;
  const sandSetter = profile.weather.find(w => w.family === 'sand')!;
  const setter = sandSetter.setter === first.name ? first : second;
  const partner = sandSetter.setter === first.name ? second : first;

  const turnOneOptions: TurnOneOption[] = [];

  if (hasMove(setter, 'Protect')) {
    turnOneOptions.push(
      turnOne(setter.name, 'Protect', 'Garante turno seguro e ativação da tempestade de areia.'),
    );
  } else {
    const attackMoves = (setter.moves ?? []).filter(
      m => normalize(m) !== 'protect',
    );
    if (attackMoves.length > 0) {
      turnOneOptions.push(
        turnOne(setter.name, attackMoves[0], 'Pressão ofensiva imediata sob areia.'),
      );
    }
  }

  if (hasMove(partner, 'Rock Slide')) {
    turnOneOptions.push(
      turnOne(partner.name, 'Rock Slide', 'Spread damage com chance de flinch sob areia.'),
    );
  } else if (hasMove(partner, 'Earthquake')) {
    turnOneOptions.push(
      turnOne(partner.name, 'Earthquake', 'Spread damage massivo aproveitando areia.'),
    );
  } else {
    const attackMoves = (partner.moves ?? []).filter(
      m => normalize(m) !== 'protect',
    );
    if (attackMoves.length > 0) {
      turnOneOptions.push(
        turnOne(partner.name, attackMoves[0], 'Pressão ofensiva sob tempestade de areia.'),
      );
    }
  }

  return {
    id: 'sand_rush',
    name: 'Areia Ofensiva',
    objective: 'Tempestade de areia potencializa Sand Rush (dobra velocidade) e causa dano chip em não-imunes.',
    lead: [first.name, second.name],
    turnOneOptions,
    requiredRoles: [
      roleReq('sand-rush-attacker', 'required', 30,
        'Abusador de Sand Rush para pressão ofensiva sob areia.'),
      roleReq('ground-or-rock-breaker', 'required', 25,
        'Atacante Ground/Rock para aproveitar STAB sob areia.'),
    ],
    optionalRoles: [
      roleReq('water-answer', 'preferred', 15,
        'Proteção contra Water, fraqueza comum de tipos Rock/Ground.'),
      roleReq('grass-answer', 'preferred', 15,
        'Cobertura contra Grass que resiste Ground.'),
      roleReq('steel-answer', 'optional', 10,
        'Cobertura contra Steel que resiste Rock.'),
    ],
    speedAxis: 'fast',
    contractValid: true,
    validationErrors: [],
    feasibilityScore: 82,
  };
}

/**
 * Gera estratégia de Neve.
 * Somente se o perfil contiver clima Snow.
 */
function generateSnow(
  lead: [PokemonData, PokemonData],
  profile: LeadCapabilityProfile,
): LeadStrategyCandidate | null {
  if (!profile.weather.some(w => w.family === 'snow')) return null;

  const [first, second] = lead;
  const snowSetter = profile.weather.find(w => w.family === 'snow')!;
  const setter = snowSetter.setter === first.name ? first : second;
  const partner = snowSetter.setter === first.name ? second : first;

  const turnOneOptions: TurnOneOption[] = [];

  if (hasMove(setter, 'Blizzard')) {
    turnOneOptions.push(
      turnOne(setter.name, 'Blizzard', 'Blizzard com 100% de precisão sob neve, spread damage.'),
    );
  } else if (hasMove(setter, 'Protect')) {
    turnOneOptions.push(
      turnOne(setter.name, 'Protect', 'Garante turno seguro e ativação da neve.'),
    );
  } else {
    const attackMoves = (setter.moves ?? []).filter(
      m => normalize(m) !== 'protect',
    );
    if (attackMoves.length > 0) {
      turnOneOptions.push(
        turnOne(setter.name, attackMoves[0], 'Pressão ofensiva imediata sob neve.'),
      );
    }
  }

  if (hasMove(partner, 'Blizzard')) {
    turnOneOptions.push(
      turnOne(partner.name, 'Blizzard', 'Blizzard com 100% de precisão sob neve.'),
    );
  } else if (hasMove(partner, 'Aurora Veil')) {
    turnOneOptions.push(
      turnOne(partner.name, 'Aurora Veil', 'Aurora Veil reduz dano recebido em 50% para o time.'),
    );
  } else {
    const attackMoves = (partner.moves ?? []).filter(
      m => normalize(m) !== 'protect',
    );
    if (attackMoves.length > 0) {
      turnOneOptions.push(
        turnOne(partner.name, attackMoves[0], 'Pressão ofensiva sob neve.'),
      );
    }
  }

  return {
    id: 'snow_offense',
    name: 'Neve Ofensiva',
    objective: 'Neve ativa Blizzard com precisão perfeita, boost de Def para Ice-types e habilita Slush Rush / Aurora Veil.',
    lead: [first.name, second.name],
    turnOneOptions,
    requiredRoles: [
      roleReq('slush-rush-attacker', 'required', 25,
        'Abusador de Slush Rush para pressão ofensiva sob neve.'),
      roleReq('ice-breaker', 'required', 25,
        'Atacante Ice para aproveitar Blizzard com precisão perfeita.'),
    ],
    optionalRoles: [
      roleReq('fire-answer', 'preferred', 15,
        'Proteção contra Fire, fraqueza de Ice.'),
      roleReq('fighting-answer', 'preferred', 15,
        'Cobertura contra Fighting, fraqueza de Ice.'),
      roleReq('steel-answer', 'optional', 10,
        'Cobertura contra Steel que resiste Ice.'),
    ],
    speedAxis: 'fast',
    contractValid: true,
    validationErrors: [],
    feasibilityScore: 78,
  };
}

/**
 * Gera estratégia de Trick Room.
 * Somente se o perfil contiver speed control Trick Room.
 */
function generateTrickRoom(
  lead: [PokemonData, PokemonData],
  profile: LeadCapabilityProfile,
): LeadStrategyCandidate | null {
  if (!profile.speedControl.some(s => s.type === 'trick_room')) return null;

  const [first, second] = lead;
  const trSetter = profile.speedControl.find(s => s.type === 'trick_room')!;
  const setter = trSetter.source === first.name ? first : second;
  const partner = trSetter.source === first.name ? second : first;

  const turnOneOptions: TurnOneOption[] = [];

  // Setter ativa Trick Room
  turnOneOptions.push(
    turnOne(setter.name, 'Trick Room', 'Inverte a ordem de velocidade para 5 turnos.'),
  );

  // Parceiro: Fake Out para proteger, ou Protect, ou ataque
  if (hasMove(partner, 'Fake Out')) {
    turnOneOptions.push(
      turnOne(partner.name, 'Fake Out', 'Flinch na ameaça mais rápida para garantir Trick Room.', 'opponent_slot_1'),
    );
  } else if (hasMove(partner, 'Follow Me') || hasMove(partner, 'Rage Powder')) {
    const redirectMove = hasMove(partner, 'Follow Me') ? 'Follow Me' : 'Rage Powder';
    turnOneOptions.push(
      turnOne(partner.name, redirectMove, 'Redireciona ataques para proteger o setter de Trick Room.'),
    );
  } else if (hasMove(partner, 'Protect')) {
    turnOneOptions.push(
      turnOne(partner.name, 'Protect', 'Garante sobrevivência enquanto Trick Room é ativado.'),
    );
  } else {
    const attackMoves = (partner.moves ?? []).filter(
      m => normalize(m) !== 'protect',
    );
    if (attackMoves.length > 0) {
      turnOneOptions.push(
        turnOne(partner.name, attackMoves[0], 'Pressão ofensiva enquanto Trick Room é ativado.'),
      );
    }
  }

  // Score: melhor se tiver Fake Out ou redirecionamento para proteger o setup
  let feasibility = 80;
  if (hasMove(partner, 'Fake Out')) feasibility += 8;
  if (profile.protection.some(p => p.type === 'follow_me' || p.type === 'rage_powder')) feasibility += 5;
  feasibility = Math.min(100, feasibility);

  return {
    id: 'trick_room',
    name: 'Inversão de Velocidade (Trick Room)',
    objective: 'Ativar Trick Room no turno 1 para habilitar atacantes pesados de baixa velocidade como sweepers.',
    lead: [first.name, second.name],
    turnOneOptions,
    requiredRoles: [
      roleReq('slow-physical-attacker', 'required', 30,
        'Atacante físico lento que domina sob Trick Room.'),
      roleReq('slow-special-attacker', 'preferred', 20,
        'Atacante especial lento para diversificar ameaças.'),
    ],
    optionalRoles: [
      roleReq('redirection', 'preferred', 15,
        'Redirecionamento para proteger Trick Room setter.'),
      roleReq('fake-out-support', 'optional', 10,
        'Fake Out para garantir turno seguro de Trick Room.'),
      roleReq('secondary-trick-room', 'optional', 10,
        'Segundo setter de Trick Room como backup.'),
    ],
    speedAxis: 'slow',
    contractValid: true,
    validationErrors: [],
    feasibilityScore: feasibility,
  };
}

/**
 * Gera estratégia de Tailwind Rush.
 * Somente se o perfil contiver speed control Tailwind.
 */
function generateTailwindRush(
  lead: [PokemonData, PokemonData],
  profile: LeadCapabilityProfile,
): LeadStrategyCandidate | null {
  if (!profile.speedControl.some(s => s.type === 'tailwind')) return null;

  const [first, second] = lead;
  const twSource = profile.speedControl.find(s => s.type === 'tailwind')!;
  const setter = twSource.source === first.name ? first : second;
  const partner = twSource.source === first.name ? second : first;

  const turnOneOptions: TurnOneOption[] = [];

  // Setter ativa Tailwind
  turnOneOptions.push(
    turnOne(setter.name, 'Tailwind', 'Dobra a velocidade do time inteiro por 4 turnos.'),
  );

  // Parceiro: Protect ou Fake Out ou ataque
  if (hasMove(partner, 'Fake Out')) {
    turnOneOptions.push(
      turnOne(partner.name, 'Fake Out', 'Flinch na ameaça adversária para garantir Tailwind.', 'opponent_slot_1'),
    );
  } else if (hasMove(partner, 'Protect')) {
    turnOneOptions.push(
      turnOne(partner.name, 'Protect', 'Garante turno seguro enquanto Tailwind é ativado.'),
    );
  } else {
    const attackMoves = (partner.moves ?? []).filter(
      m => normalize(m) !== 'protect',
    );
    if (attackMoves.length > 0) {
      turnOneOptions.push(
        turnOne(partner.name, attackMoves[0], 'Pressão ofensiva enquanto Tailwind é ativado.'),
      );
    }
  }

  // Score de viabilidade
  let feasibility = 82;
  if (hasMove(partner, 'Fake Out')) feasibility += 5;
  if (profile.protection.some(p => p.type === 'follow_me' || p.type === 'rage_powder')) feasibility += 3;
  feasibility = Math.min(100, feasibility);

  return {
    id: 'tailwind_rush',
    name: 'Corrida de Tailwind',
    objective: 'Configurar Tailwind no turno 1 para dobrar a velocidade do time e obter pressão ofensiva imediata.',
    lead: [first.name, second.name],
    turnOneOptions,
    requiredRoles: [
      roleReq('fast-sweeper', 'required', 30,
        'Sweeper rápido que domina com Tailwind ativo.'),
      roleReq('special-breaker', 'required', 25,
        'Breaker especial para diversificar ameaças sob Tailwind.'),
    ],
    optionalRoles: [
      roleReq('fake-out-support', 'preferred', 15,
        'Fake Out para garantir turno seguro de Tailwind.'),
      roleReq('priority-user', 'optional', 10,
        'Usuário de prioridade para finalizações pós-Tailwind.'),
      roleReq('pivot', 'optional', 10,
        'Pivô para reposicionar o time após Tailwind expirar.'),
    ],
    speedAxis: 'fast',
    contractValid: true,
    validationErrors: [],
    feasibilityScore: feasibility,
  };
}

/**
 * Gera estratégia de Defensive Core.
 * Gerada se houver sinergias defensivas significativas (>= 2).
 */
function generateDefensiveCore(
  lead: [PokemonData, PokemonData],
  profile: LeadCapabilityProfile,
): LeadStrategyCandidate | null {
  if (profile.defensiveSynergies.length < 2) return null;

  const [first, second] = lead;

  const turnOneOptions: TurnOneOption[] = [];

  // Primeiro: Protect ou golpe defensivo
  if (hasMove(first, 'Protect')) {
    turnOneOptions.push(
      turnOne(first.name, 'Protect', 'Garante sobrevivência e scouting do oponente.'),
    );
  } else {
    const moves = (first.moves ?? []).filter(m => normalize(m) !== 'protect');
    if (moves.length > 0) {
      turnOneOptions.push(
        turnOne(first.name, moves[0], 'Pressão defensiva ou chip damage.'),
      );
    }
  }

  // Segundo: Wide Guard ou Protect ou ataque
  if (hasMove(second, 'Wide Guard')) {
    turnOneOptions.push(
      turnOne(second.name, 'Wide Guard', 'Protege contra spread moves como Earthquake e Rock Slide.'),
    );
  } else if (hasMove(second, 'Protect')) {
    turnOneOptions.push(
      turnOne(second.name, 'Protect', 'Garante sobrevivência e scouting.'),
    );
  } else {
    const moves = (second.moves ?? []).filter(m => normalize(m) !== 'protect');
    if (moves.length > 0) {
      turnOneOptions.push(
        turnOne(second.name, moves[0], 'Pressão ou controle defensivo.'),
      );
    }
  }

  return {
    id: 'defensive_core',
    name: 'Núcleo Defensivo',
    objective: 'Sinergias defensivas da lead criam um núcleo resiliente que controla o ritmo do jogo.',
    lead: [first.name, second.name],
    turnOneOptions,
    requiredRoles: [
      roleReq('offensive-breaker', 'required', 30,
        'Breaker ofensivo para compensar o foco defensivo da lead.'),
      roleReq('win-condition', 'required', 25,
        'Condição de vitória para fechar partidas quando o núcleo defensivo segura.'),
    ],
    optionalRoles: [
      roleReq('speed-control', 'preferred', 15,
        'Controle de velocidade para complementar o núcleo defensivo.'),
      roleReq('cleric', 'optional', 10,
        'Suporte de cura/status para manter o núcleo saudável.'),
      roleReq('hazard-control', 'optional', 10,
        'Controle de hazards para manter posicionamento.'),
    ],
    speedAxis: 'neutral',
    contractValid: true,
    validationErrors: [],
    feasibilityScore: 75,
  };
}

/**
 * Gera estratégia de Redirect Setup.
 * Gerada se houver Follow Me ou Rage Powder na lead.
 */
function generateRedirectSetup(
  lead: [PokemonData, PokemonData],
  profile: LeadCapabilityProfile,
): LeadStrategyCandidate | null {
  const hasRedirect = profile.protection.some(
    p => p.type === 'follow_me' || p.type === 'rage_powder',
  );
  if (!hasRedirect) return null;

  const [first, second] = lead;
  const redirectProt = profile.protection.find(
    p => p.type === 'follow_me' || p.type === 'rage_powder',
  )!;
  const redirector = redirectProt.source === first.name ? first : second;
  const setupPokemon = redirectProt.source === first.name ? second : first;
  const redirectMoveName = redirectProt.type === 'follow_me' ? 'Follow Me' : 'Rage Powder';

  const turnOneOptions: TurnOneOption[] = [];

  // Redirecionador usa Follow Me / Rage Powder
  turnOneOptions.push(
    turnOne(redirector.name, redirectMoveName, 'Redireciona todos os ataques de single-target para si.'),
  );

  // Parceiro: setup ou ataque seguro
  const setupMoves = ['swordsdance', 'nastyplot', 'calmmind', 'irondefense', 'dragondance', 'quiverdance', 'shellsmash', 'bellydrum'];
  const partnerMoves = (setupPokemon.moves ?? []).map(m => normalize(m));
  const availableSetup = setupMoves.find(m => partnerMoves.includes(m));

  if (availableSetup) {
    // Retorna o nome original do golpe (primeira letra maiúscula de cada palavra)
    const originalMove = (setupPokemon.moves ?? []).find(
      m => normalize(m) === availableSetup,
    ) ?? availableSetup;
    turnOneOptions.push(
      turnOne(setupPokemon.name, originalMove, 'Setup seguro enquanto redirecionamento absorve ataques.'),
    );
  } else {
    const attackMoves = (setupPokemon.moves ?? []).filter(
      m => normalize(m) !== 'protect',
    );
    if (attackMoves.length > 0) {
      turnOneOptions.push(
        turnOne(setupPokemon.name, attackMoves[0], 'Ataque livre enquanto redirecionamento protege.'),
      );
    }
  }

  // Score: melhor se tiver setup disponível
  let feasibility = 80;
  if (availableSetup) feasibility += 10;
  feasibility = Math.min(100, feasibility);

  return {
    id: 'redirect_setup',
    name: 'Setup com Redirecionamento',
    objective: 'Usar redirecionamento (Follow Me / Rage Powder) para garantir setup seguro ou ataque livre no turno 1.',
    lead: [first.name, second.name],
    turnOneOptions,
    requiredRoles: [
      roleReq('setup-sweeper', 'required', 30,
        'Sweeper que se beneficia de turnos livres para setup.'),
      roleReq('offensive-coverage', 'required', 20,
        'Cobertura ofensiva para complementar o sweeper.'),
    ],
    optionalRoles: [
      roleReq('speed-control', 'preferred', 15,
        'Controle de velocidade para garantir que o sweeper atue primeiro após setup.'),
      roleReq('secondary-redirector', 'optional', 10,
        'Segundo redirecionador como backup.'),
      roleReq('priority-user', 'optional', 10,
        'Usuário de prioridade para finalização.'),
    ],
    speedAxis: 'hybrid',
    contractValid: true,
    validationErrors: [],
    feasibilityScore: feasibility,
  };
}

/**
 * Gera estratégia de Balanced Fallback.
 * Gerada como fallback se nenhuma estratégia específica foi gerada.
 */
function generateBalancedFallback(
  lead: [PokemonData, PokemonData],
  _profile: LeadCapabilityProfile,
): LeadStrategyCandidate {
  const [first, second] = lead;

  const turnOneOptions: TurnOneOption[] = [];

  // Primeiro: ataque ou Protect
  const firstAttackMoves = (first.moves ?? []).filter(
    m => normalize(m) !== 'protect',
  );
  if (firstAttackMoves.length > 0) {
    turnOneOptions.push(
      turnOne(first.name, firstAttackMoves[0], 'Pressão ofensiva para obter vantagem numérica.'),
    );
  } else if (hasMove(first, 'Protect')) {
    turnOneOptions.push(
      turnOne(first.name, 'Protect', 'Proteção enquanto avalia o campo.'),
    );
  }

  // Segundo: ataque ou Protect
  const secondAttackMoves = (second.moves ?? []).filter(
    m => normalize(m) !== 'protect',
  );
  if (secondAttackMoves.length > 0) {
    turnOneOptions.push(
      turnOne(second.name, secondAttackMoves[0], 'Cobertura ofensiva complementar.'),
    );
  } else if (hasMove(second, 'Protect')) {
    turnOneOptions.push(
      turnOne(second.name, 'Protect', 'Proteção enquanto parceiro pressiona.'),
    );
  }

  return {
    id: 'balanced_fallback',
    name: 'Equilíbrio Geral',
    objective: 'Abertura equilibrada focando em cobertura de tipo complementar e posicionamento seguro.',
    lead: [first.name, second.name],
    turnOneOptions,
    requiredRoles: [
      roleReq('type-coverage-breaker', 'required', 25,
        'Breaker com cobertura de tipo para complementar a lead.'),
      roleReq('defensive-pivot', 'required', 25,
        'Pivô defensivo para garantir trocas seguras.'),
    ],
    optionalRoles: [
      roleReq('speed-control', 'preferred', 15,
        'Controle de velocidade para flexibilidade.'),
      roleReq('priority-user', 'optional', 10,
        'Usuário de prioridade para finalizações.'),
      roleReq('utility-support', 'optional', 10,
        'Suporte utilitário (heal, status, etc.).'),
    ],
    speedAxis: 'neutral',
    contractValid: true,
    validationErrors: [],
    feasibilityScore: 65,
  };
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Gera todas as estratégias de lead viáveis baseadas no perfil de capacidades.
 * Se nenhuma estratégia específica for gerada, produz um fallback balanceado.
 *
 * @param lead - Dupla de Pokémon da lead
 * @param profile - Perfil de capacidades da lead (resultado de analyzeLeadCapabilities)
 * @param format - Formato do jogo (ex: 'gen9vgc2024regulationg')
 * @returns Lista de estratégias candidatas ordenadas por feasibilityScore
 */
export function generateLeadStrategies(
  lead: [PokemonData, PokemonData],
  profile: LeadCapabilityProfile,
  format: string,
): LeadStrategyCandidate[] {
  // O parâmetro format é recebido para futura extensão de lógica por formato
  void format;

  const strategies: LeadStrategyCandidate[] = [];

  // Estratégias de clima
  const rain = generateRainOffense(lead, profile);
  if (rain) strategies.push(rain);

  const sun = generateSunOffense(lead, profile);
  if (sun) strategies.push(sun);

  const sand = generateSandRush(lead, profile);
  if (sand) strategies.push(sand);

  const snow = generateSnow(lead, profile);
  if (snow) strategies.push(snow);

  // Estratégias de speed control
  const tr = generateTrickRoom(lead, profile);
  if (tr) strategies.push(tr);

  const tw = generateTailwindRush(lead, profile);
  if (tw) strategies.push(tw);

  // Estratégias de sinergia
  const defensive = generateDefensiveCore(lead, profile);
  if (defensive) strategies.push(defensive);

  const redirect = generateRedirectSetup(lead, profile);
  if (redirect) strategies.push(redirect);

  // Fallback se nenhuma estratégia específica foi gerada
  if (strategies.length === 0) {
    strategies.push(generateBalancedFallback(lead, profile));
  }

  // Ordena por feasibilityScore decrescente
  strategies.sort((a, b) => b.feasibilityScore - a.feasibilityScore);

  return strategies;
}
