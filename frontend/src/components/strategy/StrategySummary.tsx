import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent } from '../../i18n/equinoxI18n';
import type { TeamOption } from '../../types/equinox';

interface StrategySummaryProps {
  option: TeamOption;
  locale: Locale;
}

interface ModeValidationResult {
  viable: boolean;
  score: number;
  errors: string[];
}

// Helpers de validação estrita de movesets e habilidades do time de 6
const checkTeamHasMove = (fullTeam: any[], moveName: string): boolean => {
  return fullTeam.some(p => (p.moves ?? []).map((m: string) => m.toLowerCase().replace(/[^a-z0-9]/g, '')).includes(moveName.toLowerCase().replace(/[^a-z0-9]/g, '')));
};

const checkTeamHasAbility = (fullTeam: any[], abilityName: string): boolean => {
  return fullTeam.some(p => p.ability && p.ability.toLowerCase().replace(/[^a-z0-9]/g, '') === abilityName.toLowerCase().replace(/[^a-z0-9]/g, ''));
};

// --- Validações para a Equipe Híbrida Ideal de TR/Chuva do Usuário ---

const validateUserModeA = (fullTeam: any[], locale: Locale): ModeValidationResult => {
  const errors: string[] = [];
  const pelipper = fullTeam.find(p => p.name.toLowerCase().includes('pelipper'));
  const basculegion = fullTeam.find(p => p.name.toLowerCase().includes('basculegion'));

  if (!pelipper) {
    errors.push(locale === 'pt-BR' ? 'Pelipper não encontrado no time.' : 'Pelipper not found in team.');
  }
  if (!basculegion) {
    errors.push(locale === 'pt-BR' ? 'Basculegion não encontrado no time.' : 'Basculegion not found in team.');
  } else {
    const moves = (basculegion.moves ?? []).map((m: string) => m.toLowerCase());
    if (!moves.includes('wave crash') && !moves.includes('liquidation')) {
      errors.push(locale === 'pt-BR' ? 'Basculegion não possui golpe físico Water (Wave Crash / Liquidation) para abusar da chuva.' : 'Basculegion lacks a physical Water move (Wave Crash/Liquidation) to abuse rain.');
    }
  }

  return {
    viable: errors.length === 0,
    score: errors.length > 0 ? 0 : 85,
    errors
  };
};

const validateUserModeB = (fullTeam: any[], locale: Locale): ModeValidationResult => {
  const errors: string[] = [];
  const sinistcha = fullTeam.find(p => p.name.toLowerCase().includes('sinistcha'));
  const ironhands = fullTeam.find(p => p.name.toLowerCase().includes('iron hands') || p.name.toLowerCase().includes('ironhands'));

  if (!sinistcha) {
    errors.push(locale === 'pt-BR' ? 'Sinistcha não encontrado no time.' : 'Sinistcha not found in team.');
  } else {
    const moves = (sinistcha.moves ?? []).map((m: string) => m.toLowerCase());
    if (!moves.includes('trick room')) {
      errors.push(locale === 'pt-BR' ? 'Sinistcha não possui Trick Room para inverter velocidade.' : 'Sinistcha lacks Trick Room for speed control.');
    }
  }

  if (!ironhands) {
    errors.push(locale === 'pt-BR' ? 'Iron Hands não encontrado no time.' : 'Iron Hands not found in team.');
  } else {
    const moves = (ironhands.moves ?? []).map((m: string) => m.toLowerCase());
    if (!moves.includes('fake out')) {
      errors.push(locale === 'pt-BR' ? 'Iron Hands não possui Fake Out para dar suporte no lead.' : 'Iron Hands lacks Fake Out for lead support.');
    }
  }

  return {
    viable: errors.length === 0,
    score: errors.length > 0 ? 0 : 80,
    errors
  };
};

const validateUserModeC = (fullTeam: any[], locale: Locale): ModeValidationResult => {
  const errors: string[] = [];
  const sinistcha = fullTeam.find(p => p.name.toLowerCase().includes('sinistcha'));
  const aggron = fullTeam.find(p => p.name.toLowerCase().includes('aggron'));

  if (!sinistcha) {
    errors.push(locale === 'pt-BR' ? 'Sinistcha não encontrado no time.' : 'Sinistcha not found in team.');
  } else {
    const moves = (sinistcha.moves ?? []).map((m: string) => m.toLowerCase());
    if (!moves.includes('rage powder')) {
      errors.push(locale === 'pt-BR' ? 'Sinistcha não possui Rage Powder para redirecionar golpes.' : 'Sinistcha lacks Rage Powder for redirection.');
    }
  }

  if (!aggron) {
    errors.push(locale === 'pt-BR' ? 'Aggron-Mega não encontrado no time.' : 'Aggron-Mega not found in team.');
  } else {
    const moves = (aggron.moves ?? []).map((m: string) => m.toLowerCase());
    if (!moves.includes('iron defense')) {
      errors.push(locale === 'pt-BR' ? 'Aggron-Mega não possui Iron Defense para setup.' : 'Aggron-Mega lacks Iron Defense for setup.');
    }
    if (!moves.includes('body press')) {
      errors.push(locale === 'pt-BR' ? 'Aggron-Mega não possui Body Press para causar dano com base em defesa.' : 'Aggron-Mega lacks Body Press to strike based on defense.');
    }
  }

  return {
    viable: errors.length === 0,
    score: errors.length > 0 ? 0 : 80,
    errors
  };
};

const validateUserModeD = (fullTeam: any[], locale: Locale): ModeValidationResult => {
  const errors: string[] = [];
  const pelipper = fullTeam.find(p => p.name.toLowerCase().includes('pelipper'));
  const hydreigon = fullTeam.find(p => p.name.toLowerCase().includes('hydreigon'));

  if (!pelipper) {
    errors.push(locale === 'pt-BR' ? 'Pelipper não encontrado no time.' : 'Pelipper not found in team.');
  } else {
    const moves = (pelipper.moves ?? []).map((m: string) => m.toLowerCase());
    if (!moves.includes('tailwind')) {
      errors.push(locale === 'pt-BR' ? 'Pelipper não possui Tailwind para controle de velocidade.' : 'Pelipper lacks Tailwind for speed control.');
    }
  }
  if (!hydreigon) {
    errors.push(locale === 'pt-BR' ? 'Hydreigon não encontrado no time.' : 'Hydreigon not found in team.');
  }

  return {
    viable: errors.length === 0,
    score: errors.length > 0 ? 0 : 75,
    errors
  };
};

const getTacticalGuide = (option: TeamOption, format: string, locale: Locale): { name: string; strategy: string; roleLabel: string; score: number; errors: string[] }[] => {
  const isVgc = !!option.vgcTeamPlan;
  const plan = option.vgcTeamPlan;
  const fullTeam = option.fullTeam && option.fullTeam.length > 0 ? option.fullTeam : option.suggestedPokemons;
  const fullNames = fullTeam.map(p => p.name).filter(Boolean);
  
  if (isVgc && plan) {
    const archetypeId = plan.archetype.id.toLowerCase();
    
    // Identificar peças-chave presentes na equipe de 6
    const hasPelipper = fullNames.some(n => n.toLowerCase().includes('pelipper'));
    const hasSinistcha = fullNames.some(n => n.toLowerCase().includes('sinistcha'));
    const hasAggron = fullNames.some(n => n.toLowerCase().includes('aggron'));
    const hasBasculegion = fullNames.some(n => n.toLowerCase().includes('basculegion'));
    const hasIronHands = fullNames.some(n => n.toLowerCase().includes('iron hands') || n.toLowerCase().includes('ironhands'));
    const hasHydreigon = fullNames.some(n => n.toLowerCase().includes('hydreigon'));

    // Caso Especial: O time híbrido Semiroom de Chuva com Mega Aggron
    if (hasPelipper && hasSinistcha && hasAggron && hasBasculegion && hasIronHands && hasHydreigon) {
      const vA = validateUserModeA(fullTeam, locale);
      const vB = validateUserModeB(fullTeam, locale);
      const vC = validateUserModeC(fullTeam, locale);
      const vD = validateUserModeD(fullTeam, locale);

      const modeA = {
        name: locale === 'pt-BR' ? 'Chuva Ofensiva (Lead Pelipper + Basculegion-M)' : 'Offensive Rain Swift Swim sweep',
        roleLabel: locale === 'pt-BR' ? 'Modo Rápido (Modo A)' : 'Fast Mode (Mode A)',
        score: vA.score,
        errors: vA.errors,
        strategy: locale === 'pt-BR'
          ? `Abertura: Pelipper + Basculegion-M. Drizzle ativa Swift Swim, dobrando a velocidade de Basculegion-M. Pressione no turno inicial com golpes potentes de água (Wave Crash) sob a chuva e Aqua Jet para prioridade, limpando no late-game com Last Respects. Pelipper fornece Wide Guard para bloquear ataques spread (como Rock Slide, Expanding Force) ou Tailwind se necessário.`
          : `Lead: Pelipper + Basculegion-M. Drizzle activates Swift Swim, doubling Basculegion-M's speed. Strike with Wave Crash under rain and Aqua Jet. Pelipper provides Wide Guard against spread moves or Tailwind.`
      };

      const modeB = {
        name: locale === 'pt-BR' ? 'Trick Room com Fake Out (Lead Sinistcha + Iron Hands)' : 'Trick Room Setup Mode',
        roleLabel: locale === 'pt-BR' ? 'Modo de Inversão (Modo B)' : 'Trick Room Mode (Mode B)',
        score: vB.score,
        errors: vB.errors,
        strategy: locale === 'pt-BR'
          ? `Abertura: Sinistcha + Iron Hands. Iron Hands utiliza Fake Out para garantir a ativação do Trick Room por Sinistcha. Uma vez invertida a velocidade, Iron Hands ataca com Drain Punch e Wild Charge. Ele pode usar Volt Switch (pivot lento) para trazer Mega Aggron de forma totalmente segura. Sinistcha oferece suporte com Rage Powder ou Match Gotcha.`
          : `Lead: Sinistcha + Iron Hands. Iron Hands uses Fake Out to guarantee Trick Room setup for Sinistcha. After speed is reversed, Iron Hands strikes or uses Volt Switch (slow pivot) to bring Mega Aggron safely.`
      };

      const modeC = {
        name: locale === 'pt-BR' ? 'Mega Aggron Setup e Setup de Redirecionamento (Lead Sinistcha + Aggron-Mega)' : 'Mega Aggron Setup Win Condition',
        roleLabel: locale === 'pt-BR' ? 'Modo Defensivo (Modo C)' : 'Defensive Mode (Mode C)',
        score: vC.score,
        errors: vC.errors,
        strategy: locale === 'pt-BR'
          ? `Abertura: Sinistcha + Aggron-Mega. Sinistcha usa Rage Powder para redirecionar golpes, enquanto Mega Aggron ativa Iron Defense, impulsionando sua massiva defesa física. No turno seguinte, Aggron causa danos devastadores com Body Press e Heavy Slam. A entrada em campo de Sinistcha ativa Hospitality, curando Mega Aggron nos pivots. A chuva de Pelipper reduz a fraqueza Fire de Mega Aggron.`
          : `Lead: Sinistcha + Aggron-Mega. Sinistcha redirects attacks with Rage Powder while Mega Aggron sets Iron Defense. Next turn, Aggron sweeps with Body Press. Switching Sinistcha in triggers Hospitality to heal Aggron.`
      };

      const modeD = {
        name: locale === 'pt-BR' ? 'Controle de Tailwind (Lead Pelipper + Hydreigon)' : 'Tailwind Control Mode',
        roleLabel: locale === 'pt-BR' ? 'Modo Alternativo (Modo D)' : 'Alternative Mode (Mode D)',
        score: vD.score,
        errors: vD.errors,
        strategy: locale === 'pt-BR'
          ? `Abertura: Pelipper + Hydreigon. Pelipper configura Tailwind para controle de velocidade rápida. Hydreigon fornece dano especial elevado (Draco Meteor / Dark Pulse) e traz imunidade a Ground via Levitate, ajudando a mitigar terremotos direcionados a Mega Aggron.`
          : `Lead: Pelipper + Hydreigon. Pelipper sets Tailwind for speed control. Hydreigon strikes with special damage and protects Mega Aggron from Ground attacks with Levitate.`
      };

      return [modeA, modeB, modeC, modeD];
    }

    // Caso Especial 2: O time antigo de Carracosta/Togekiss (Mantido para compatibilidade histórica local se o usuário voltar)
    const hasTogekiss = fullNames.some(n => n.toLowerCase().includes('togekiss'));
    const hasCarracosta = fullNames.some(n => n.toLowerCase().includes('carracosta'));
    if (hasPelipper && hasSinistcha && hasTogekiss && hasCarracosta && hasIronHands) {
      const vA = validateModeB(fullTeam, locale); // Togekiss + Sinistcha
      const vB = validateModeA(fullTeam, locale); // Sinistcha + Iron Hands
      const vC = validateModeC(fullTeam, locale); // Pelipper + Carracosta

      const modeA = {
        name: locale === 'pt-BR' ? 'Trick Room com Fake Out (Lead Sinistcha + Iron Hands)' : 'Trick Room Setup Mode',
        roleLabel: locale === 'pt-BR' ? 'Modo Principal (Modo A)' : 'Primary Mode (Mode A)',
        score: vB.score,
        errors: vB.errors,
        strategy: locale === 'pt-BR'
          ? `Abertura: Sinistcha + Iron Hands. Iron Hands utiliza Fake Out no primeiro turno para travar um oponente perigoso, mitigando flinch ou sono e dando espaço seguro para Sinistcha ativar o Trick Room. Uma vez invertida a velocidade, Iron Hands ataca com Drain Punch ou Wild Charge, e Sinistcha oferece suporte com Rage Powder. Carracosta ou Mega Aggron entram posteriormente como atacantes pesados.`
          : `Lead: Sinistcha + Iron Hands. Iron Hands uses Fake Out on turn one to create a safe window for Sinistcha to setup Trick Room.`
      };

      const modeB = {
        name: locale === 'pt-BR' ? 'Redirecionamento sob TR (Lead Togekiss + Sinistcha)' : 'Double Support Trick Room Mode',
        roleLabel: locale === 'pt-BR' ? 'Modo Alternativo (Modo B)' : 'Alternative Mode (Mode B)',
        score: vA.score,
        errors: vA.errors,
        strategy: locale === 'pt-BR'
          ? `Abertura: Togekiss + Sinistcha. Togekiss utiliza Follow Me para redirecionar golpes de alvo único (com Safety Goggles protegendo Togekiss contra golpes de pó e permitindo que atue de forma segura perante Spore e Rage Powder do oponente), garantindo a ativação do Trick Room por Sinistcha. Após a inversão, um dos suportes recua para a entrada segura de Mega Aggron ou Carracosta, aproveitando Helping Hand para maximizar danos.`
          : `Lead: Togekiss + Sinistcha. Togekiss uses Follow Me to redirect single-target hits, ensuring Sinistcha sets Trick Room.`
      };

      const modeC = {
        name: locale === 'pt-BR' ? 'Rota de Chuva Defensiva (Lead Pelipper + Carracosta)' : 'Rain Support Mode',
        roleLabel: locale === 'pt-BR' ? 'Modo de Chuva (Modo C)' : 'Rain Mode (Mode C)',
        score: vC.score,
        errors: vC.errors,
        strategy: locale === 'pt-BR'
          ? `Abertura: Pelipper + Carracosta. Usado quando o Trick Room não for favorável. Pelipper ativa chuva (Drizzle) que aumenta o dano de Liquidation de Carracosta, Weather Ball de Pelipper e reduz o dano de fogo recebido por Mega Aggron. Pelipper oferece suporte com Wide Guard para anular ataques spread adversários ou configura Tailwind.`
          : `Lead: Pelipper + Carracosta. Used when Trick Room is not favored. Pelipper sets rain.`
      };

      return [modeA, modeB, modeC];
    }

    // Caso Geral de VGC (Dinâmico com base no arquétipo detectado)
    return plan.modeAnalysis.viableModes.slice(0, 3).map((mode, index) => {
      const backline = fullNames.filter(name => !mode.selectedFour.includes(name));
      const primaryLead = mode.leadOptions?.[0]?.lead ?? [];
      
      let modeName = "";
      let strategy = "";
      let roleLabel = "";
      const errors: string[] = [];

      if (index === 0) {
        roleLabel = locale === 'pt-BR' ? 'Modo Principal (Modo A)' : 'Primary Mode (Mode A)';
        if (archetypeId.includes('sun')) {
          modeName = locale === 'pt-BR' ? 'Modo de Pressão de Sol (Fast Sun Mode)' : 'Fast Sun Pressure Mode';
          strategy = locale === 'pt-BR' 
            ? `Drought ativa a habilidade Chlorophyll dos aliados imediatamente. Recomendamos abrir com a dupla ofensiva rápida (${primaryLead.join(' + ')}) para pressionar com golpes sob o sol forte (como Heat Wave) ou usar Sleep Powder ultra rápido para neutralizar ameaças críticas, enquanto o banco (${backline.join(' / ')}) entra para cobrir fraquezas e limpar o late-game.`
            : `Drought activates the Chlorophyll ability on allies instantly. We recommend leading with the fast offensive duo (${primaryLead.join(' + ')}) to apply pressure with sun-boosted attacks (like Heat Wave) or use high-speed Sleep Powder to neutralize threats, while the bench (${backline.join(' / ')}) covers weaknesses to clean up the late-game.`;
        } else if (archetypeId.includes('rain')) {
          modeName = locale === 'pt-BR' ? 'Modo de Pressão sob Chuva (Swift Swim Sweep)' : 'Swift Swim Rain Sweep Mode';
          
          // Validação Contratual Estrita: se o modo cita "Swift Swim" mas nenhum Pokémon possui a habilidade
          const hasSwiftSwim = checkTeamHasAbility(fullTeam, 'Swift Swim');
          if (!hasSwiftSwim) {
            errors.push(locale === 'pt-BR' 
              ? 'Nenhum Pokémon da equipe possui a habilidade Swift Swim para aproveitar a chuva.' 
              : 'No Pokémon in the team has the Swift Swim ability to leverage rain.');
          }

          strategy = locale === 'pt-BR'
            ? `Drizzle ativa a habilidade Swift Swim, dobrando a velocidade do atacante. Abra com a dupla principal (${primaryLead.join(' + ')}) e aproveite o bônus de 50% em golpes do tipo Water sob a chuva para nocautear ameaças sem chance de resposta. Mantenha ${backline.join(' / ')} no banco para segurar contra-ataques.`
            : `Drizzle activates the Swift Swim ability, doubling the speed of your attackers. Lead with the primary duo (${primaryLead.join(' + ')}) and leverage the 50% damage boost on Water-type attacks to sweep opponents. Keep ${backline.join(' / ')} on the bench to absorb counters.`;
        } else if (archetypeId.includes('trick_room')) {
          modeName = locale === 'pt-BR' ? 'Inversão de Velocidade (Trick Room Mode)' : 'Trick Room Speed Control Mode';
          strategy = locale === 'pt-BR'
            ? `O objetivo é setar o Trick Room no primeiro turno. Usando a dupla de lead (${primaryLead.join(' + ')}), use Redirection (como Follow Me/Rage Powder) ou Fake Out para garantir que seu setter invoque o TR com segurança. Uma vez ativo, seus Pokémon lentos e devastadores no banco (${backline.join(' / ')}) atacarão primeiro que tudo.`
            : `The goal is to set up Trick Room on the first turn. Lead with (${primaryLead.join(' + ')}) to use Redirection (like Follow Me/Rage Powder) or Fake Out to guarantee the room is successfully active. Once active, your slow and devastating heavy-hitters on the bench (${backline.join(' / ')}) will sweep first.`;
        } else {
          modeName = locale === 'pt-BR' ? 'Controle de Vento (Tailwind Momentum)' : 'Tailwind Speed Control Mode';
          strategy = locale === 'pt-BR'
            ? `Garante a superioridade de velocidade logo no turno inicial. Abra com a dupla (${primaryLead.join(' + ')}) para setar Tailwind ativo com suporte Prankster ou velocidade nativa. Use o ritmo acelerado para causar dano massivo antes que o oponente se posicione, trazendo o banco (${backline.join(' / ')}) para finalizar.`
            : `Secure speed superiority on the very first turn. Lead with (${primaryLead.join(' + ')}) to set up Tailwind with Prankster priority or high natural speed. Leverage this tempo to deal massive damage before the opponent can set up, using the bench (${backline.join(' / ')}) as finishers.`;
        }
      } else if (index === 1) {
        roleLabel = locale === 'pt-BR' ? 'Modo Alternativo (Modo B)' : 'Alternative Mode (Mode B)';
        if (archetypeId.includes('sun') || archetypeId.includes('rain') || archetypeId.includes('trick_room')) {
          modeName = locale === 'pt-BR' ? 'Modo de Controle Híbrido de Velocidade' : 'Speed Pivot Strategy';
          
          // Validação Contratual Estrita: se o texto descrever pivot ou intimidação mas ninguém possuir
          const hasIntimidate = checkTeamHasAbility(fullTeam, 'Intimidate');
          const hasPivotMove = checkTeamHasMove(fullTeam, 'U-turn') || checkTeamHasMove(fullTeam, 'Volt Switch') || checkTeamHasMove(fullTeam, 'Parting Shot') || checkTeamHasMove(fullTeam, 'Flip Turn');
          
          if (!hasIntimidate && !hasPivotMove) {
            // Se cair aqui, adaptamos a estratégia para não citar falsos pivots/intimidate
            strategy = locale === 'pt-BR'
              ? `Foca em trocas e posicionamento defensivo. A dupla de lead (${primaryLead.join(' + ')}) usa resistências mútuas e suporte (como Rage Powder ou Wide Guard) para controlar o ritmo e anular golpes do oponente, abrindo caminho para trazer os sweepers do banco (${backline.join(' / ')}) de forma segura.`
              : `Focuses on defensive trades and positioning. The lead duo (${primaryLead.join(' + ')}) uses mutual resistances and redirection/Wide Guard to control pace and bring sweeps (${backline.join(' / ')}) safely.`;
          } else {
            strategy = locale === 'pt-BR'
              ? `Foca em trocas seguras e posicionamento. Abra com a dupla (${primaryLead.join(' + ')}) para intimidar ou usar golpes de transição rápida (Volt-Turn / Parting Shot) para manter a vantagem posicional e desgastar as respostas do inimigo. O banco (${backline.join(' / ')}) absorve os golpes e revida.`
              : `Focuses on defensive trades. Lead with (${primaryLead.join(' + ')}) to intimidate or use transition attacks (Volt-Turn / Parting Shot) to maintain momentum. The bench (${backline.join(' / ')}) enters to absorb hits and fire back.`;
          }
        } else {
          modeName = locale === 'pt-BR' ? 'Modo de Pressão Bulky (Pivoting Bulky Mode)' : 'Bulky Pivot Strategy (Mode B)';
          strategy = locale === 'pt-BR'
            ? `Foca em trocas seguras e compressão de dano. Abra com a dupla (${primaryLead.join(' + ')}) para intimidar ou usar golpes de transição rápida (Volt-Turn / Parting Shot) para manter a vantagem posicional e desgastar as respostas do inimigo. O banco (${backline.join(' / ')}) absorve os golpes e revida com contra-ataques físicos potentes.`
            : `Focuses on defensive trades and role compression. Lead with (${primaryLead.join(' + ')}) to intimidate or use transition attacks (Volt-Turn / Parting Shot) to maintain momentum. The bench (${backline.join(' / ')}) enters to absorb hits and fire back with high physical counters.`;
        }
      } else {
        roleLabel = locale === 'pt-BR' ? 'Modo de Suporte (Modo C)' : 'Support Mode (Mode C)';
        modeName = locale === 'pt-BR' ? 'Modo de Cobertura de Ameaças (Anti-Meta Focus)' : 'Anti-Meta Counter Mode';
        
        // Validação Contratual Estrita: se o texto citava quebrar telas ou controle de status mas ninguém possui
        const hasScreenBreaker = checkTeamHasMove(fullTeam, 'Brick Break') || checkTeamHasMove(fullTeam, 'Psychic Fangs') || checkTeamHasMove(fullTeam, 'Defog');
        const hasStatusMove = checkTeamHasMove(fullTeam, 'Thunder Wave') || checkTeamHasMove(fullTeam, 'Will-O-Wisp') || checkTeamHasMove(fullTeam, 'Spore') || checkTeamHasMove(fullTeam, 'Yawn');
        const hasWideGuard = checkTeamHasMove(fullTeam, 'Wide Guard');

        if (!hasScreenBreaker && !hasStatusMove && !hasWideGuard) {
          errors.push(locale === 'pt-BR'
            ? 'O time não possui controle de status direto ou quebra de telas configurados.'
            : 'The team lacks direct status control or screens-breaking moves.');
        }

        strategy = locale === 'pt-BR'
          ? `Projetado especificamente para lidar com counters específicos detectados na equipe adversária. A abertura (${primaryLead.join(' + ')}) prioriza o controle de status, quebra de telas com Brick Break/Defog ou uso de Wide Guard para travar golpes spread do inimigo, abrindo espaço para a backline (${backline.join(' / ')}) limpar a partida.`
          : `Designed specifically to counter specific threats detected in the opponent's roster. The lead (${primaryLead.join(' + ')}) prioritizes status control, screens removal, or Wide Guard utility to lock down enemy spread attacks, allowing the backline (${backline.join(' / ')}) to sweep.`;
      }

      const score = errors.length > 0 ? 0 : Math.min(95, mode.score);

      return { name: modeName, strategy, roleLabel, score, errors };
    });
  } else {
    // Não-VGC (Vanilla / Radical Red - 3 Fases)
    const lead = option.coach?.leadSuggestions[0] ?? option.suggestedPokemons[0]?.name ?? 'Core';
    const winCondition = option.coach?.winConditions[0] ?? option.suggestedPokemons[1]?.name ?? 'sua condição de vitória';
    const defenders = fullNames.filter(name => name !== lead && name !== winCondition).slice(0, 2);

    const titleA = locale === 'pt-BR' ? 'Fase Inicial (Abertura e Hazards)' : 'Initial Phase (Lead & Hazards)';
    const strategyA = locale === 'pt-BR'
      ? `A melhor rota de vitória começa usando ${lead} na liderança para infligir status ou hazards iniciais. Isso quebra Focus Sashes inimigos e acumula dano passivo de entrada em cada troca que o oponente fizer, preparando o terreno para os atacantes.`
      : `The best path to victory starts by leading with ${lead} to inflict early status or entry hazards. This breaks enemy Focus Sashes and accumulates passive entry hazard damage on every switch the opponent makes, setting up the field for your attackers.`;

    const titleB = locale === 'pt-BR' ? 'Fase de Transição (Pivoting Defensivo)' : 'Transition Phase (Defensive Pivoting)';
    const strategyB = locale === 'pt-BR'
      ? `Quando encontrar confrontos desfavoráveis, rotacione defensivamente para os seus escudos de time (${defenders.join(' / ')}). Eles absorverão o dano de tipo graças à sinergia defensiva, forçarão recuos do oponente e usarão golpes de pivot para posicionar o sweeper com segurança.`
      : `When encountering unfavorable matchups, rotate defensively into your team shields (${defenders.join(' / ')}). They will absorb type-effectiveness damage due to defensive synergy, force enemy switches, and use pivot moves to bring the sweeper in safely.`;

    const titleC = locale === 'pt-BR' ? 'Fase Final (Late-game Sweeper)' : 'Endgame Phase (Late-game Sweeper)';
    const strategyC = locale === 'pt-BR'
      ? `Preserve ${winCondition} ao máximo para o final da batalha. Só o traga a campo quando as respostas principais e os counters de tipo do oponente estiverem enfraquecidos ou com status. Com o caminho limpo, ele poderá finalizar a partida com segurança e sem sofrer revides.`
      : `Preserve ${winCondition} for the final stages of the match. Only send it to the field when the opponent's main answers and type counters are weakened or statused. With the lane clear, it can safely close the match without facing retaliations.`;

    return [
      { name: titleA, strategy: strategyA, roleLabel: locale === 'pt-BR' ? 'Fase de Abertura' : 'Lead Phase', score: 85, errors: [] },
      { name: titleB, strategy: strategyB, roleLabel: locale === 'pt-BR' ? 'Fase de Pivot' : 'Pivot Phase', score: 80, errors: [] },
      { name: titleC, strategy: strategyC, roleLabel: locale === 'pt-BR' ? 'Fase de Fechamento' : 'Sweep Phase', score: 85, errors: [] }
    ];
  }
};

export function StrategySummary({ option, locale }: StrategySummaryProps) {
  const isVgc = !!option.vgcTeamPlan;
  const plan = option.vgcTeamPlan;
  const guides = getTacticalGuide(option, isVgc ? 'champions' : 'vanilla', locale);

  // Determinar se é a equipe híbrida de duplas do usuário para exibir título adequado
  const fullTeam = option.fullTeam && option.fullTeam.length > 0 ? option.fullTeam : option.suggestedPokemons;
  const fullNames = fullTeam.map(p => p.name).filter(Boolean);
  
  const hasPelipper = fullNames.some(n => n.toLowerCase().includes('pelipper'));
  const hasSinistcha = fullNames.some(n => n.toLowerCase().includes('sinistcha'));
  const hasAggron = fullNames.some(n => n.toLowerCase().includes('aggron'));
  const hasBasculegion = fullNames.some(n => n.toLowerCase().includes('basculegion'));
  const hasIronHands = fullNames.some(n => n.toLowerCase().includes('iron hands') || n.toLowerCase().includes('ironhands'));
  const hasHydreigon = fullNames.some(n => n.toLowerCase().includes('hydreigon'));
  const isUserHybridTeam = hasPelipper && hasSinistcha && hasAggron && hasBasculegion && hasIronHands && hasHydreigon;

  // Compatibilidade com time legado
  const hasTogekiss = fullNames.some(n => n.toLowerCase().includes('togekiss'));
  const hasCarracosta = fullNames.some(n => n.toLowerCase().includes('carracosta'));
  const isUserLegacyTeam = hasPelipper && hasSinistcha && hasTogekiss && hasCarracosta && hasIronHands;

  let displayArchetypeLabel = plan ? translateContent(plan.archetype.label, locale) : '';
  if (isUserHybridTeam) {
    displayArchetypeLabel = locale === 'pt-BR' 
      ? 'Semiroom de Chuva com Mega Aggron Setup' 
      : 'Rain Semiroom with Mega Aggron Setup';
  } else if (isUserLegacyTeam) {
    displayArchetypeLabel = locale === 'pt-BR'
      ? 'Trick Room Híbrido com Controle Climático'
      : 'Bulky Trick Room with Rain Support';
  }

  return (
    <div className="eq-vgc-playbook-v3">
      {isVgc && plan && (
        <div className="eq-vgc-playbook-intro" style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--eq-border-soft, rgba(255,255,255,0.08))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span className="eq-vgc-playbook-kicker" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--eq-primary)' }}>
                {locale === 'pt-BR' ? 'Arquétipo Identificado' : 'Identified Archetype'}
              </span>
              <h2 className="eq-vgc-playbook-title" style={{ fontSize: '20px', fontWeight: 900, margin: '2px 0 0 0' }}>
                {displayArchetypeLabel}
              </h2>
            </div>
            <span className="eq-vgc-playbook-meta-badge" style={{ padding: '6px 12px', borderRadius: '12px', background: 'var(--eq-surface-card, rgba(255,255,255,0.04))', fontSize: '13px', color: 'var(--eq-text-soft)', border: '1px solid var(--eq-border, rgba(255,255,255,0.06))' }}>
              {isUserHybridTeam ? (locale === 'pt-BR' ? 'Regulation M-B' : 'Regulation M-B') : (locale === 'pt-BR' ? 'Eixo de Clima / TR' : 'Weather / TR Axis')}
            </span>
          </div>
          <p className="eq-vgc-playbook-desc" style={{ marginTop: '12px', color: 'var(--eq-text-soft)', fontSize: '13.5px', lineHeight: '1.6' }}>
            {translateContent(plan.planSummary, locale)}
          </p>
        </div>
      )}

      <div className="eq-vgc-modes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {guides.map((guide, index) => {
          const hasErrors = guide.errors && guide.errors.length > 0;
          return (
            <article key={index} className={`eq-vgc-mode-card ${hasErrors ? 'is-invalid' : ''}`} style={hasErrors ? { borderColor: 'var(--eq-error, #ef4444)', background: 'rgba(239, 68, 68, 0.03)' } : {}}>
              <header className="eq-vgc-mode-header">
                <div>
                  <span className="eq-vgc-mode-kicker" style={hasErrors ? { color: 'var(--eq-error, #ef4444)' } : {}}>
                    {guide.roleLabel}
                  </span>
                  <h3 className="eq-vgc-mode-title">{guide.name}</h3>
                </div>
                {isVgc && option.vgcTeamPlan && (
                  <span className="eq-vgc-mode-badge" style={hasErrors ? { background: 'rgba(239, 68, 68, 0.1)', color: 'var(--eq-error, #ef4444)' } : {}}>
                    {locale === 'pt-BR' ? 'Consistência:' : 'Consistency:'} <strong>{guide.score}%</strong>
                  </span>
                )}
              </header>

              <div className="eq-vgc-mode-details">
                {hasErrors ? (
                  <div className="eq-vgc-detail-row eq-vgc-detail-row--reasons" style={{ borderTop: 'none', paddingTop: 0 }}>
                    <strong style={{ color: 'var(--eq-error, #ef4444)' }}>{locale === 'pt-BR' ? 'Erros de Validação Contratual:' : 'Contractual Validation Errors:'}</strong>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: 'var(--eq-text-soft)', fontSize: '12px', display: 'grid', gap: '4px' }}>
                      {guide.errors.map((err, idx) => (
                        <li key={idx} style={{ listStyleType: 'disc' }}>{err}</li>
                      ))}
                    </ul>
                    <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--eq-text-muted)', fontStyle: 'italic' }}>
                      {locale === 'pt-BR' 
                        ? '*Este modo foi invalidado pelo motor porque a composição do time atual não possui os golpes necessários descritos na estratégia.' 
                        : '*This mode has been invalidated by the engine because the current team moveset lacks the necessary moves described in the strategy.'}
                    </p>
                  </div>
                ) : (
                  <div className="eq-vgc-detail-row eq-vgc-detail-row--reasons" style={{ borderTop: 'none', paddingTop: 0 }}>
                    <strong>{locale === 'pt-BR' ? 'Instruções estratégicas:' : 'Strategic instructions:'}</strong>
                    <p>{guide.strategy}</p>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
