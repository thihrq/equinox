import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent } from '../../i18n/equinoxI18n';
import type { TeamOption } from '../../types/equinox';

interface VgcTeamPlanPanelProps {
  option: TeamOption;
  locale: Locale;
}

export function VgcTeamPlanPanel({ option, locale }: VgcTeamPlanPanelProps) {
  const plan = option.vgcTeamPlan;

  if (!plan) {
    return <p className="eq-muted-text">{t(locale, 'noVgcTeamPlan')}</p>;
  }

  const matchupRows = [
    [t(locale, 'vgcRain'), plan.matchupReadiness.rain],
    [t(locale, 'vgcTrickRoom'), plan.matchupReadiness.trickRoom],
    [t(locale, 'vgcTailwindOffense'), plan.matchupReadiness.tailwindOffense],
    [t(locale, 'vgcSetupRedirection'), plan.matchupReadiness.setupRedirection],
    [t(locale, 'vgcWeatherWar'), plan.matchupReadiness.weatherWar],
  ] as const;

  return (
    <section className="eq-ai-builder-panel">
      <div className="eq-ai-builder-overview">
        <div>
          <span>{t(locale, 'vgcArchetype')}</span>
          <strong>{plan.archetype.label}</strong>
          <p>{translateContent(plan.planSummary, locale)}</p>
        </div>

        <div className="eq-ai-builder-metrics">
          <Metric label={t(locale, 'vgcPlanScore')} value={`${plan.score}%`} />
          <Metric label={t(locale, 'vgcRoleCoverage')} value={`${plan.roleCoverage.coverageScore}%`} />
          <Metric label={t(locale, 'vgcModeConsistency')} value={`${plan.modeAnalysis.modeConsistencyScore}%`} />
        </div>
      </div>

      <div className="eq-ai-builder-grid">
        <ListBlock title={t(locale, 'vgcRecommendations')} items={plan.recommendations} locale={locale} />
        <ListBlock title={t(locale, 'vgcConcerns')} items={plan.concerns.length ? plan.concerns : [t(locale, 'vgcNoMajorConcerns')]} locale={locale} />
        <ListBlock title={t(locale, 'vgcMissingRoles')} items={plan.roleCoverage.missingCriticalRoles.length ? plan.roleCoverage.missingCriticalRoles : [t(locale, 'vgcNoMissingCriticalRoles')]} locale={locale} />
        {plan.mechanicCoverage && (
          <ListBlock
            title={t(locale, 'vgcMechanicContract')}
            items={
              plan.mechanicCoverage.missingCriticalMechanics.length
                ? plan.mechanicCoverage.missingCriticalMechanics
                : [t(locale, 'vgcMechanicContractOk')]
            }
            locale={locale}
          />
        )}
      </div>

      {plan.assessment && (
        <div style={{ display: 'grid', gap: '16px', marginTop: '20px', marginBottom: '20px' }}>
          {plan.assessment.contractErrors && plan.assessment.contractErrors.length > 0 && (
            <div style={{
              padding: '16px',
              border: '1px solid #ef4444',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.08)',
              color: 'var(--eq-text)'
            }}>
              <strong style={{ display: 'block', marginBottom: '8px', color: '#ef4444', fontSize: '14px' }}>
                ⚠️ {locale === 'pt-BR' ? 'Erros de Execução' : 'Execution Errors'}
              </strong>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', display: 'grid', gap: '4px' }}>
                {plan.assessment.contractErrors.map((err: any) => (
                  <li key={err.code}>{err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {plan.assessment.warnings && plan.assessment.warnings.length > 0 && (
            <div style={{
              padding: '16px',
              border: '1px solid #f59e0b',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.08)',
              color: 'var(--eq-text)'
            }}>
              <strong style={{ display: 'block', marginBottom: '8px', color: '#f59e0b', fontSize: '14px' }}>
                💡 {locale === 'pt-BR' ? 'Pontos de Atenção' : 'Points of Attention'}
              </strong>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', display: 'grid', gap: '4px' }}>
                {plan.assessment.warnings.map((warn: any) => (
                  <li key={warn.code}>{warn.message}</li>
                ))}
              </ul>
            </div>
          )}

          {plan.assessment.matchupRisks && plan.assessment.matchupRisks.length > 0 && (
            <div style={{
              padding: '16px',
              border: '1px solid #8b5cf6',
              borderRadius: '12px',
              background: 'rgba(139, 92, 246, 0.08)',
              color: 'var(--eq-text)'
            }}>
              <strong style={{ display: 'block', marginBottom: '8px', color: '#8b5cf6', fontSize: '14px' }}>
                🎯 {locale === 'pt-BR' ? 'Riscos do Confronto' : 'Matchup Risks'}
              </strong>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', display: 'grid', gap: '4px' }}>
                {plan.assessment.matchupRisks.map((risk: any) => (
                  <li key={risk.code}>{risk.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {plan.modeAnalysis.bestLeads.length > 0 && (
        <div className="eq-ai-list-block">
          <strong>{t(locale, 'vgcBestLeads')}</strong>
          <ul>
            {plan.modeAnalysis.bestLeads.slice(0, 4).map((lead, index) => (
              <li key={`${lead.lead.join('-')}-${index}`}>
                <b>{lead.lead.join(' + ')}</b> · {lead.score}% — {translateContent(lead.reasons[0] ?? t(locale, 'vgcLeadDefaultReason'), locale)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.modeAnalysis.viableModes.length > 0 && (
        <div className="eq-ai-list-block" style={{ display: 'grid', gap: '16px', marginTop: '20px' }}>
          <strong style={{ fontSize: '14px', color: 'var(--eq-text)' }}>
            {locale === 'pt-BR' ? 'Playbooks de Combate Disponíveis (Quartetos)' : 'Available Battle Playbooks (Quartets)'}
          </strong>
          <div style={{ display: 'grid', gap: '12px' }}>
            {plan.modeAnalysis.viableModes.slice(0, 3).map((mode, index) => {
              const hasLeadBackline = mode.lead && mode.backline;
              return (
                <div key={`${mode.selectedFour.join('-')}-${index}`} style={{
                  padding: '16px',
                  border: '1px solid var(--eq-border)',
                  borderRadius: '12px',
                  background: 'var(--eq-surface-soft)',
                  display: 'grid',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--eq-text)' }}>
                      {locale === 'pt-BR' ? `Modo ${index + 1}: ` : `Mode ${index + 1}: `}
                      {mode.selectedFour.join(' / ')}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      background: 'var(--eq-border)',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      color: 'var(--eq-text-muted)'
                    }}>
                      {mode.score}% {locale === 'pt-BR' ? 'Consistência' : 'Consistency'}
                    </span>
                  </div>

                  {hasLeadBackline && (
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                        🚀 <b>Lead:</b> {mode.lead?.join(' + ')}
                      </span>
                      <span style={{ background: 'var(--eq-border)', padding: '4px 8px', borderRadius: '6px' }}>
                        📥 <b>Banco:</b> {mode.backline?.join(' + ')}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'grid', gap: '4px', fontSize: '12px', color: 'var(--eq-text-muted)', marginTop: '4px' }}>
                    <strong>{locale === 'pt-BR' ? 'Guia Tático do Playbook:' : 'Playbook Tactical Guide:'}</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '4px' }}>
                      {mode.reasons.map((reason, rIdx) => (
                        <li key={rIdx}>{translateContent(reason, locale)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="eq-ai-score-grid">
        {matchupRows.map(([label, score]) => (
          <div key={label}>
            <span>{label}</span>
            <i><b style={{ width: `${Number(score)}%` }} /></i>
            <strong>{score}</strong>
          </div>
        ))}
      </div>

      {plan.leadMetrics && (
        <div className="eq-ai-list-block" style={{ marginTop: '20px', borderTop: '1px dashed var(--eq-border)', paddingTop: '16px' }}>
          <strong style={{ fontSize: '14px', color: 'var(--eq-accent)' }}>
            {locale === 'pt-BR' ? 'Métricas de Performance da Lead' : 'Lead Performance Metrics'}
          </strong>
          <div className="eq-ai-score-grid" style={{ marginTop: '12px' }}>
            <div>
              <span>{locale === 'pt-BR' ? 'Validade Mecânica' : 'Mechanical Validity'}</span>
              <i><b style={{ width: `${plan.leadMetrics.mechanicalValidity}%`, background: 'var(--eq-accent)' }} /></i>
              <strong>{plan.leadMetrics.mechanicalValidity}%</strong>
            </div>
            <div>
              <span>{locale === 'pt-BR' ? 'Execução do Turno Inicial' : 'Initial Turn Execution'}</span>
              <i><b style={{ width: `${plan.leadMetrics.initialTurnExecution}%`, background: 'var(--eq-accent)' }} /></i>
              <strong>{plan.leadMetrics.initialTurnExecution}%</strong>
            </div>
            <div>
              <span>{locale === 'pt-BR' ? 'Resistência a Disrupção' : 'Disruption Resistance'}</span>
              <i><b style={{ width: `${plan.leadMetrics.disruptionResistance}%`, background: 'var(--eq-accent)' }} /></i>
              <strong>{plan.leadMetrics.disruptionResistance}%</strong>
            </div>
            <div>
              <span>{locale === 'pt-BR' ? 'Conversão Ofensiva' : 'Offensive Conversion'}</span>
              <i><b style={{ width: `${plan.leadMetrics.offensiveConversion}%`, background: 'var(--eq-accent)' }} /></i>
              <strong>{plan.leadMetrics.offensiveConversion}%</strong>
            </div>
            <div>
              <span>{locale === 'pt-BR' ? 'Índice Estratégico' : 'Strategic Index'}</span>
              <i><b style={{ width: `${plan.leadMetrics.strategicIndex}%`, background: 'var(--eq-accent)' }} /></i>
              <strong>{plan.leadMetrics.strategicIndex}%</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ListBlock({ title, items, locale }: { title: string; items: string[]; locale: Locale }) {
  return (
    <article className="eq-ai-list-block">
      <strong>{title}</strong>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${item}-${index}`}>{translateContent(item, locale)}</li>
        ))}
      </ul>
    </article>
  );
}
