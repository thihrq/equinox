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
        <div className="eq-ai-list-block">
          <strong>{t(locale, 'vgcViableModes')}</strong>
          <ul>
            {plan.modeAnalysis.viableModes.slice(0, 3).map((mode, index) => (
              <li key={`${mode.selectedFour.join('-')}-${index}`}>
                <b>{mode.selectedFour.join(' / ')}</b> · {mode.score}% — {translateContent(mode.reasons[0] ?? t(locale, 'vgcModeDefaultReason'), locale)}
              </li>
            ))}
          </ul>
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
