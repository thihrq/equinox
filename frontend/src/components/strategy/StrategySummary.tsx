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

export function StrategySummary({ option, locale }: StrategySummaryProps) {
  // Renderização dinâmica se o formato for VGC / Champions Doubles
  if (option.vgcTeamPlan && option.vgcTeamPlan.modeAnalysis?.viableModes?.length > 0) {
    const plan = option.vgcTeamPlan;
    const fullNames = option.fullTeam?.map(p => p.name).filter(Boolean) ?? [];

    return (
      <div className="eq-vgc-playbook-v3">
        <div className="eq-vgc-playbook-intro">
          <p className="eq-vgc-playbook-desc">
            {translateContent(plan.planSummary, locale)}
          </p>
        </div>

        <div className="eq-vgc-modes-grid">
          {plan.modeAnalysis.viableModes.slice(0, 2).map((mode, index) => {
            const label = index === 0 
              ? (locale === 'pt-BR' ? 'Modo de Jogo Principal (Modo A)' : 'Primary Game Mode (Mode A)') 
              : (locale === 'pt-BR' ? `Modo de Jogo Alternativo (Modo ${String.fromCharCode(65 + index)})` : `Alternative Game Mode (Mode ${String.fromCharCode(65 + index)})`);
            
            // Descobrir quem está no banco (backline)
            const backline = fullNames.filter(name => !mode.selectedFour.includes(name));
            
            // Melhores leads sugeridos para este modo
            const primaryLead = mode.leadOptions?.[0]?.lead ?? [];
            const leadReasons = mode.leadOptions?.[0]?.reasons ?? [];
            const modeReasons = mode.reasons ?? [];

            return (
              <article key={index} className="eq-vgc-mode-card">
                <header className="eq-vgc-mode-header">
                  <div>
                    <span className="eq-vgc-mode-kicker">{label}</span>
                    <h3 className="eq-vgc-mode-title">{mode.selectedFour.join(' / ')}</h3>
                  </div>
                  <span className="eq-vgc-mode-badge">
                    {locale === 'pt-BR' ? 'Consistência:' : 'Consistency:'} <strong>{mode.score}%</strong>
                  </span>
                </header>

                <div className="eq-vgc-mode-details">
                  <div className="eq-vgc-detail-row">
                    <strong>{locale === 'pt-BR' ? 'Lead de 2 sugerido:' : 'Suggested 2-Lead:'}</strong>
                    <span>{primaryLead.length > 0 ? primaryLead.join(' + ') : '—'}</span>
                  </div>

                  <div className="eq-vgc-detail-row">
                    <strong>{locale === 'pt-BR' ? 'No Banco (Backline):' : 'On the Bench (Backline):'}</strong>
                    <span>{backline.length > 0 ? backline.join(' / ') : '—'}</span>
                  </div>

                  <div className="eq-vgc-detail-row eq-vgc-detail-row--reasons">
                    <strong>{locale === 'pt-BR' ? 'Análise tática:' : 'Tactical analysis:'}</strong>
                    <p>
                      {leadReasons.length > 0 
                        ? translateContent(leadReasons[0], locale) 
                        : (modeReasons.length > 0 ? translateContent(modeReasons[0], locale) : (locale === 'pt-BR' ? 'Equilíbrio padrão do arquétipo.' : 'Standard archetype balance.'))}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback padrão para formatos Vanilla/Radical Red
  const winCondition = option.coach?.winConditions[0] ?? `${option.suggestedPokemons[0]?.name ?? 'Core'} ${t(locale, 'winConditionSuffix')}`;
  const preserve = option.coach?.preservePokemon[0] ?? t(locale, 'distributedRoles');
  const lead = option.coach?.leadSuggestions[0] ?? option.suggestedPokemons[0]?.name ?? '—';
  const risks = getDangerousThreats(option);

  const preserveIsDistributed = preserve === 'Funções distribuídas' || preserve === 'Distributed roles';

  const panels = [
    {
      title: t(locale, 'winCondition'),
      value: translateContent(winCondition, locale),
      detail: translateContent(option.coach?.winConditions[1], locale) || t(locale, 'preparePiece'),
    },
    {
      title: t(locale, 'preserve'),
      value: translateContent(preserve, locale),
      detail: preserveIsDistributed ? t(locale, 'adaptIfPieceFalls') : t(locale, 'avoidLosingPiece'),
    },
    {
      title: t(locale, 'lead'),
      value: lead,
      detail: t(locale, 'openingPositioning'),
    },
    {
      title: t(locale, 'riskRadar'),
      value: risks[0]?.threat.name ?? t(locale, 'noCriticalRisk'),
      detail: translateContent(risks[0]?.problems[0], locale) || t(locale, 'mainAnswersDistributed'),
    },
  ];

  return (
    <section className="eq-strategy-summary-v3">
      {panels.map(panel => (
        <article key={panel.title} className="eq-strategy-card-v3">
          <span>{panel.title}</span>
          <strong>{panel.value}</strong>
          <p>{panel.detail}</p>
        </article>
      ))}
    </section>
  );
}
