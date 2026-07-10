import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent } from '../../i18n/equinoxI18n';
import type { TeamOption } from '../../types/equinox';

interface StrategySummaryProps {
  option: TeamOption;
  locale: Locale;
}

const getTacticalGuide = (option: TeamOption, format: string, locale: Locale): { name: string; strategy: string; roleLabel: string }[] => {
  const isVgc = !!option.vgcTeamPlan;
  const plan = option.vgcTeamPlan;
  const fullNames = option.fullTeam?.map(p => p.name).filter(Boolean) ?? [];
  
  if (isVgc && plan) {
    const archetypeId = plan.archetype.id.toLowerCase();
    
    // Identificar peças-chave presentes na equipe de 6
    const hasPelipper = fullNames.some(n => n.toLowerCase().includes('pelipper'));
    const hasOverqwil = fullNames.some(n => n.toLowerCase().includes('overqwil'));
    const hasAggron = fullNames.some(n => n.toLowerCase().includes('aggron'));
    const hasSinistcha = fullNames.some(n => n.toLowerCase().includes('sinistcha'));
    const hasTogekiss = fullNames.some(n => n.toLowerCase().includes('togekiss'));
    const hasRelicanth = fullNames.some(n => n.toLowerCase().includes('relicanth'));

    // Caso Especial: O time de Chuva de Megas do Usuário
    if (hasPelipper && (hasOverqwil || hasRelicanth) && (hasAggron || hasSinistcha || hasTogekiss)) {
      const modeA = {
        name: locale === 'pt-BR' ? 'Pressão sob Chuva Ofensiva (Swift Swim Sweep)' : 'Offensive Swift Swim Sweep',
        roleLabel: locale === 'pt-BR' ? 'Modo Principal (Modo A)' : 'Primary Mode (Mode A)',
        strategy: locale === 'pt-BR'
          ? `Abertura: Pelipper + Overqwil (ou Relicanth). O objetivo é ativar a chuva (Drizzle) e pressionar imediatamente com golpes potentes de água (Liquidation / Wave Crash) aproveitando a velocidade dobrada do Swift Swim. Use Tailwind com Pelipper apenas se o oponente possuir controle de velocidade concorrente, e mantenha Hurricane e Weather Ball ativos para enfraquecer counters de Grass/Fighting.`
          : `Lead: Pelipper + Overqwil (or Relicanth). The goal is to set rain (Drizzle) and apply high immediate pressure with water attacks (Liquidation / Wave Crash) leveraging the doubled Swift Swim speed. Only set Tailwind if the opponent has speed control, keeping Hurricane/Weather Ball active to weaken Grass/Fighting counters.`
      };

      const modeB = {
        name: locale === 'pt-BR' ? 'Aggron sob Controle Defensivo (Trick Room Mode)' : 'Defensive Trick Room & Pivot Mode',
        roleLabel: locale === 'pt-BR' ? 'Modo Alternativo (Modo B)' : 'Alternative Mode (Mode B)',
        strategy: locale === 'pt-BR'
          ? `Abertura: Sinistcha + Aggron-Mega. Usado contra equipes de alta velocidade ou quando a chuva pura é neutralizada. Sinistcha oferece suporte vital com Rage Powder para redirecionar ataques, ou ativa o Trick Room para inverter a ordem de velocidade. A habilidade Hospitality cura o Aggron em trocas, permitindo que ele bata pesado com Heavy Slam e Body Press sob a proteção da chuva (que reduz seu dano de fogo).`
          : `Lead: Sinistcha + Aggron-Mega. Used against fast teams or when weather setup is neutralized. Sinistcha provides crucial support with Rage Powder or sets Trick Room to reverse turn order. Hospitality recovers Aggron on pivots, allowing it to strike with Heavy Slam/Body Press protected by rain (which cuts fire damage).`
      };

      const modeC = {
        name: locale === 'pt-BR' ? 'Redirecionamento e Suporte Ofensivo (Helping Hand Support)' : 'Redirection & Helping Hand Support',
        roleLabel: locale === 'pt-BR' ? 'Modo de Suporte (Modo C)' : 'Support Mode (Mode C)',
        strategy: locale === 'pt-BR'
          ? `Abertura: Togekiss + Overqwil (ou Aggron-Mega). Foca em proteger um atacante de grande impacto contra ameaças de alvo único. Togekiss usa Follow Me (com Safety Goggles impedindo redirecionamentos por esporos) para absorver o dano, enquanto potencializa os ataques do parceiro usando Helping Hand. Ideal contra equipes agressivas sem alto dano em área.`
          : `Lead: Togekiss + Overqwil (or Aggron-Mega). Focuses on protecting a single heavy hitter. Togekiss uses Follow Me (with Safety Goggles preventing spore sleep) to absorb single-target hits, while boosting the partner's damage with Helping Hand. Highly effective against hyper-offensive single-target teams.`
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

      if (index === 0) {
        roleLabel = locale === 'pt-BR' ? 'Modo Principal (Modo A)' : 'Primary Mode (Mode A)';
        if (archetypeId.includes('sun')) {
          modeName = locale === 'pt-BR' ? 'Modo de Pressão de Sol (Fast Sun Mode)' : 'Fast Sun Pressure Mode';
          strategy = locale === 'pt-BR' 
            ? `Drought ativa a habilidade Chlorophyll dos aliados imediatamente. Recomendamos abrir com a dupla ofensiva rápida (${primaryLead.join(' + ')}) para pressionar com golpes sob o sol forte (como Heat Wave) ou usar Sleep Powder ultra rápido para neutralizar ameaças críticas, enquanto o banco (${backline.join(' / ')}) entra para cobrir fraquezas e limpar o late-game.`
            : `Drought activates the Chlorophyll ability on allies instantly. We recommend leading with the fast offensive duo (${primaryLead.join(' + ')}) to apply pressure with sun-boosted attacks (like Heat Wave) or use high-speed Sleep Powder to neutralize threats, while the bench (${backline.join(' / ')}) covers weaknesses to clean up the late-game.`;
        } else if (archetypeId.includes('rain')) {
          modeName = locale === 'pt-BR' ? 'Modo de Pressão sob Chuva (Swift Swim Sweep)' : 'Swift Swim Rain Sweep Mode';
          strategy = locale === 'pt-BR'
            ? `Drizzle ativa a habilidade Swift Swim, dobrando a velocidade do atacante. Abra com a dupla principal (${primaryLead.join(' + ')}) e aproveite o bônus de 50% em golpes do tipo Water (como Liquidation ou Muddy Water) sob a chuva para nocautear ameaças sem chance de resposta. Mantenha ${backline.join(' / ')} no banco para segurar contra-ataques.`
            : `Drizzle activates the Swift Swim ability, doubling the speed of your attackers. Lead with the primary duo (${primaryLead.join(' + ')}) and leverage the 50% damage boost on Water-type attacks (like Liquidation or Muddy Water) to sweep opponents. Keep ${backline.join(' / ')} on the bench to absorb counters.`;
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
          modeName = locale === 'pt-BR' ? 'Modo de Pivot e Trocas (Tactical Pivot Mode)' : 'Tactical Pivot & Position Mode';
          strategy = locale === 'pt-BR'
            ? `Usado contra equipes com forte controle de clima/terreno concorrente. A dupla de abertura (${primaryLead.join(' + ')}) foca em rotacionar posições usando intimidação ou imunidades defensivas para desgastar os recursos adversários. Isso cria janelas livres para a entrada dos sweepers do banco (${backline.join(' / ')}) sem sofrer danos.`
            : `Used against teams with competitive weather/terrain control. The opening duo (${primaryLead.join(' + ')}) focuses on rotating positions using intimidation or defensive immunities to wear down opponent resources, opening free entry windows for your bench sweeps (${backline.join(' / ')}) without taking damage.`;
        } else {
          modeName = locale === 'pt-BR' ? 'Modo de Pressão Bulky (Pivoting Bulky Mode)' : 'Bulky Pivot Strategy (Mode B)';
          strategy = locale === 'pt-BR'
            ? `Foca em trocas seguras e compressão de dano. Abra com a dupla (${primaryLead.join(' + ')}) para intimidar ou usar golpes de transição rápida (Volt-Turn / Parting Shot) para manter a vantagem posicional e desgastar as respostas do inimigo. O banco (${backline.join(' / ')}) absorve os golpes e revida com contra-ataques físicos potentes.`
            : `Focuses on defensive trades and role compression. Lead with (${primaryLead.join(' + ')}) to intimidate or use transition attacks (Volt-Turn / Parting Shot) to maintain momentum. The bench (${backline.join(' / ')}) enters to absorb hits and fire back with high physical counters.`;
        }
      } else {
        roleLabel = locale === 'pt-BR' ? 'Modo de Suporte (Modo C)' : 'Support Mode (Mode C)';
        modeName = locale === 'pt-BR' ? 'Modo de Cobertura de Ameaças (Anti-Meta Focus)' : 'Anti-Meta Counter Mode';
        strategy = locale === 'pt-BR'
          ? `Projetado especificamente para lidar com counters específicos detectados na equipe adversária. A abertura (${primaryLead.join(' + ')}) prioriza o controle de status, quebra de telas com Brick Break/Psychic Fangs ou uso de Wide Guard para travar golpes spread do inimigo, abrindo espaço para a backline (${backline.join(' / ')}) limpar a partida.`
          : `Designed specifically to counter specific threats detected in the opponent's roster. The lead (${primaryLead.join(' + ')}) prioritizes status control, screens removal, or Wide Guard utility to lock down enemy spread attacks, allowing the backline (${backline.join(' / ')}) to sweep.`;
      }

      return { name: modeName, strategy, roleLabel };
    });
  } else {
    // Não-VGC (Vanilla / Radical Red - 3 Fases)
    const lead = option.coach?.leadSuggestions[0] ?? option.suggestedPokemons[0]?.name ?? 'Core';
    const winCondition = option.coach?.winConditions[0] ?? option.suggestedPokemons[1]?.name ?? 'sua condição de vitória';
    const cleanNames = option.fullTeam?.map(p => p.name).filter(Boolean) ?? [];
    const defenders = cleanNames.filter(name => name !== lead && name !== winCondition).slice(0, 2);

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
      { name: titleA, strategy: strategyA, roleLabel: locale === 'pt-BR' ? 'Fase de Abertura' : 'Lead Phase' },
      { name: titleB, strategy: strategyB, roleLabel: locale === 'pt-BR' ? 'Fase de Pivot' : 'Pivot Phase' },
      { name: titleC, strategy: strategyC, roleLabel: locale === 'pt-BR' ? 'Fase de Fechamento' : 'Sweep Phase' }
    ];
  }
};

export function StrategySummary({ option, locale }: StrategySummaryProps) {
  const isVgc = !!option.vgcTeamPlan;
  const guides = getTacticalGuide(option, option.vgcTeamPlan ? 'champions' : 'vanilla', locale);

  return (
    <div className="eq-vgc-playbook-v3">
      {isVgc && option.vgcTeamPlan && (
        <div className="eq-vgc-playbook-intro">
          <p className="eq-vgc-playbook-desc">
            {translateContent(option.vgcTeamPlan.planSummary, locale)}
          </p>
        </div>
      )}

      <div className="eq-vgc-modes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {guides.map((guide, index) => {
          return (
            <article key={index} className="eq-vgc-mode-card">
              <header className="eq-vgc-mode-header">
                <div>
                  <span className="eq-vgc-mode-kicker">
                    {guide.roleLabel}
                  </span>
                  <h3 className="eq-vgc-mode-title">{guide.name}</h3>
                </div>
                {isVgc && option.vgcTeamPlan && (
                  <span className="eq-vgc-mode-badge">
                    {locale === 'pt-BR' ? 'Consistência:' : 'Consistency:'} <strong>{Math.min(95, option.vgcTeamPlan.modeAnalysis.viableModes[index]?.score ?? 0)}%</strong>
                  </span>
                )}
              </header>

              <div className="eq-vgc-mode-details">
                <div className="eq-vgc-detail-row eq-vgc-detail-row--reasons" style={{ borderTop: 'none', paddingTop: 0 }}>
                  <strong>{locale === 'pt-BR' ? 'Instruções estratégicas:' : 'Strategic instructions:'}</strong>
                  <p>{guide.strategy}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
