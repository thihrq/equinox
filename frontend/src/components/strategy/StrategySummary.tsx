import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent } from '../../i18n/equinoxI18n';
import type { TeamOption } from '../../types/equinox';

interface StrategySummaryProps {
  option: TeamOption;
  locale: Locale;
}

const getDangerousThreats = (option: TeamOption) => {
  const dangerous = option.threatAnalysis?.dangerousThreats ?? [];
  const critical = option.threatAnalysis?.criticalThreats ?? [];
  return [...critical, ...dangerous].slice(0, 4);
};

const getTacticalGuide = (option: TeamOption, format: string, locale: Locale): { name: string; strategy: string }[] => {
  const isVgc = !!option.vgcTeamPlan;
  const plan = option.vgcTeamPlan;
  
  if (isVgc && plan) {
    const archetypeId = plan.archetype.id.toLowerCase();
    const fullNames = option.fullTeam?.map(p => p.name).filter(Boolean) ?? [];

    return plan.modeAnalysis.viableModes.slice(0, 2).map((mode, index) => {
      const backline = fullNames.filter(name => !mode.selectedFour.includes(name));
      const primaryLead = mode.leadOptions?.[0]?.lead ?? [];
      
      let modeName = "";
      let strategy = "";

      if (index === 0) {
        // Modo Principal
        if (archetypeId.includes('sun')) {
          modeName = locale === 'pt-BR' ? 'Modo de Pressão de Sol (Fast Sun Mode)' : 'Fast Sun Pressure Mode';
          strategy = locale === 'pt-BR' 
            ? `Drought ativa a habilidade Chlorophyll dos aliados imediatamente. Recomendamos abrir com a dupla ofensiva rápida (${primaryLead.join(' + ')}) para pressionar com golpes sob o sol forte (como Heat Wave) ou usar Sleep Powder ultra rápido para neutralizar ameaças críticas, enquanto o banco (${backline.join(' / ')}) entra para cobrir fraquezas e limpar o late-game.`
            : `Drought activates the Chlorophyll ability on allies instantly. We recommend leading with the fast offensive duo (${primaryLead.join(' + ')}) to apply pressure with sun-boosted attacks (like Heat Wave) or use high-speed Sleep Powder to neutralize threats, while the bench (${backline.join(' / ')}) covers weaknesses to clean up the late-game.`;
        } else if (archetypeId.includes('rain')) {
          modeName = locale === 'pt-BR' ? 'Modo de Pressão sob Chuva (Swift Swim Sweep)' : 'Swift Swim Rain Sweep Mode';
          strategy = locale === 'pt-BR'
            ? `Drizzle ativa a habilidade Swift Swim, dobrando a velocidade do atacante. Abra com a dupla principal (${primaryLead.join(' + ')}) e aproveite o bônus de 50% em golpes do tipo Water (como Muddy Water) sob a chuva para nocautear ameaças sem chance de resposta. Mantenha ${backline.join(' / ')} no banco para segurar contra-ataques.`
            : `Drizzle activates the Swift Swim ability, doubling the speed of your attackers. Lead with the primary duo (${primaryLead.join(' + ')}) and leverage the 50% damage boost on Water-type attacks (like Muddy Water) to sweep opponents. Keep ${backline.join(' / ')} on the bench to absorb counters.`;
        } else if (archetypeId.includes('trick_room')) {
          modeName = locale === 'pt-BR' ? 'Inversão de Velocidade (Trick Room Mode)' : 'Trick Room Speed Control Mode';
          strategy = locale === 'pt-BR'
            ? `O objetivo é setar o Trick Room no primeiro turno. Usando a dupla de lead (${primaryLead.join(' + ')}), use Redirection (como Follow Me/Rage Powder) ou Fake Out para garantir que seu setter invoque o TR com segurança. Uma vez ativo, seus Pokémon lentos e devastadores no banco (${backline.join(' / ')}) atacarão primeiro que tudo.`
            : `The goal is to set up Trick Room on the first turn. Lead with (${primaryLead.join(' + ')}) to use Redirection (like Follow Me/Rage Powder) or Fake Out to guarantee the room is successfully active. Once active, your slow and devastating heavy-hitters on the bench (${backline.join(' / ')}) will sweep first.`;
        } else if (archetypeId.includes('sand') || archetypeId.includes('snow')) {
          modeName = locale === 'pt-BR' ? 'Ajuste de Clima Defensivo (Weather Synergy)' : 'Weather Core Control Mode';
          strategy = locale === 'pt-BR'
            ? `Abra com a dupla (${primaryLead.join(' + ')}) para ativar os boosts passivos de status do clima (como 50% extra de Sp. Def para Rock-types na tempestade de areia, ou Def para Ice-types na neve). Rotacione com o banco (${backline.join(' / ')}) para manter a pressão defensiva e desgastar o time oponente.`
            : `Lead with (${primaryLead.join(' + ')}) to activate passive weather defense boosts (like 50% extra Sp. Def for Rock-types in sandstorm, or Def for Ice-types in snow). Rotate with the bench (${backline.join(' / ')}) to maintain defensive pressure and wear down the enemy.`;
        } else {
          modeName = locale === 'pt-BR' ? 'Controle de Vento (Tailwind Momentum)' : 'Tailwind Speed Control Mode';
          strategy = locale === 'pt-BR'
            ? `Garante a superioridade de velocidade logo no turno inicial. Abra com a dupla (${primaryLead.join(' + ')}) para setar Tailwind ativo com suporte Prankster ou velocidade nativa. Use o ritmo acelerado para causar dano massivo antes que o oponente se posicione, trazendo o banco (${backline.join(' / ')}) para finalizar.`
            : `Secure speed superiority on the very first turn. Lead with (${primaryLead.join(' + ')}) to set up Tailwind with Prankster priority or high natural speed. Leverage this tempo to deal massive damage before the opponent can set up, using the bench (${backline.join(' / ')}) as finishers.`;
        }
      } else {
        // Modo Alternativo (Modo B)
        if (archetypeId.includes('sun') || archetypeId.includes('rain') || archetypeId.includes('trick_room')) {
          modeName = locale === 'pt-BR' ? 'Modo de Controle e Posicionamento (Turn Control Mode)' : 'Tactical Pivot & Control Mode (Mode B)';
          strategy = locale === 'pt-BR'
            ? `Usado contra times extremamente agressivos ou de controle concorrente. A dupla de abertura (${primaryLead.join(' + ')}) foca em travar as ações inimigas usando Encore, Disable ou status rápidos, ditando as ações do oponente. Isso abre janelas seguras para trazer o banco ofensivo (${backline.join(' / ')}) em turnos de Protect livres.`
            : `Used against hyper-aggressive teams or mirror control matchups. The opening duo (${primaryLead.join(' + ')}) focuses on locking down enemy moves using Encore, Disable, or status, forcing predictable plays. This creates safe entry windows for your backup sweeps (${backline.join(' / ')}) during free protect turns.`;
        } else {
          modeName = locale === 'pt-BR' ? 'Modo de Pressão Bulky (Pivoting Bulky Mode)' : 'Bulky Pivot Strategy (Mode B)';
          strategy = locale === 'pt-BR'
            ? `Foca em trocas seguras e compressão de dano. Abra com a dupla (${primaryLead.join(' + ')}) para intimidar ou usar golpes de transição rápida (Volt-Turn / Parting Shot) para manter a vantagem posicional e desgastar as respostas do inimigo. O banco (${backline.join(' / ')}) absorve os golpes e revida com contra-ataques físicos potentes.`
            : `Focuses on defensive trades and role compression. Lead with (${primaryLead.join(' + ')}) to intimidate or use transition attacks (Volt-Turn / Parting Shot) to maintain momentum. The bench (${backline.join(' / ')}) enters to absorb hits and fire back with high physical counters.`;
        }
      }

      return { name: modeName, strategy };
    });
  } else {
    // Não-VGC (Vanilla / Radical Red)
    const lead = option.coach?.leadSuggestions[0] ?? option.suggestedPokemons[0]?.name ?? 'Core';
    const winCondition = option.coach?.winConditions[0] ?? option.suggestedPokemons[1]?.name ?? 'sua condição de vitória';
    const cleanNames = option.fullTeam?.map(p => p.name).filter(Boolean) ?? [];
    const defenders = cleanNames.filter(name => name !== lead && name !== winCondition).slice(0, 2);

    const titleA = locale === 'pt-BR' ? 'Estratégia de Abertura & Posicionamento' : 'Opening & Positioning Strategy';
    const strategyA = locale === 'pt-BR'
      ? `A melhor rota de vitória começa usando ${lead} na liderança para infligir status ou hazards iniciais. Quando encontrar confrontos desfavoráveis, rotacione defensivamente para os seus escudos de time (${defenders.join(' / ')}), que absorverão o dano de tipo graças à sinergia defensiva, para depois abrir caminho para o sweep final.`
      : `The best path to victory starts by leading with ${lead} to inflict early status or entry hazards. When encountering unfavorable matchups, rotate defensively into your team shields (${defenders.join(' / ')}), which will absorb type-effectiveness damage due to synergy, paving the way for the sweep.`;

    const titleB = locale === 'pt-BR' ? 'Estratégia de Fechamento (Late-game Sweep)' : 'Late-game Sweeping Strategy (Mode B)';
    const strategyB = locale === 'pt-BR'
      ? `Preserve ${winCondition} ao máximo para o final da batalha. Só o traga a campo quando as respostas principais e os counters de tipo do oponente estiverem enfraquecidos ou com status. Com o caminho limpo e o sol/clima ativo se aplicável, ele poderá finalizar a partida com segurança e sem sofrer revides.`
      : `Preserve ${winCondition} for the final stages of the match. Only send it to the field when the opponent's main answers and type counters are weakened or statused. With the lane clear, it can safely close the match without facing retaliations.`;

    return [
      { name: titleA, strategy: strategyA },
      { name: titleB, strategy: strategyB }
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

      <div className="eq-vgc-modes-grid">
        {guides.map((guide, index) => {
          return (
            <article key={index} className="eq-vgc-mode-card">
              <header className="eq-vgc-mode-header">
                <div>
                  <span className="eq-vgc-mode-kicker">
                    {isVgc 
                      ? (index === 0 ? (locale === 'pt-BR' ? 'Modo Principal (Modo A)' : 'Primary Mode (Mode A)') : (locale === 'pt-BR' ? 'Modo Alternativo (Modo B)' : 'Alternative Mode (Mode B)'))
                      : (index === 0 ? (locale === 'pt-BR' ? 'Fase Inicial (Abertura)' : 'Initial Phase (Lead)') : (locale === 'pt-BR' ? 'Fase Final (Sweeper)' : 'Endgame Phase (Sweeper)'))
                    }
                  </span>
                  <h3 className="eq-vgc-mode-title">{guide.name}</h3>
                </div>
                {isVgc && option.vgcTeamPlan && (
                  <span className="eq-vgc-mode-badge">
                    {locale === 'pt-BR' ? 'Consistência:' : 'Consistency:'} <strong>{option.vgcTeamPlan.modeAnalysis.viableModes[index]?.score ?? 0}%</strong>
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
