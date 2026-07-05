import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent, translateMatchupLevel } from '../../i18n/equinoxI18n';
import type { ChampionsThreatAnswer, TeamOption } from '../../types/equinox';

interface ChampionsRegulationPanelProps {
  option: TeamOption;
  locale: Locale;
}

const formatScore = (value?: number): string => `${Math.round(value ?? 0)}%`;

export function ChampionsRegulationPanel({ option, locale }: ChampionsRegulationPanelProps) {
  const regulation = option.championsRegulation;

  if (!regulation) {
    return <p className="eq-muted-text">{t(locale, 'noChampionsRegulation')}</p>;
  }

  return (
    <section className="eq-champions-regulation-panel">
      <div className="eq-champions-regulation-hero">
        <div>
          <span>{t(locale, 'championsRegulationSet')}</span>
          <strong>{translateContent(regulation.label, locale)}</strong>
          <p>
            {translateContent(regulation.seasonLabel, locale)} · {regulation.startDate} — {regulation.endDate} · {translateContent(regulation.dataStatus, locale)}
          </p>
        </div>

        <div className="eq-champions-regulation-metrics">
          <Metric label={t(locale, 'regulationFit')} value={formatScore(regulation.score)} />
          <Metric label={t(locale, 'decisionConfidence')} value={formatScore(regulation.confidence)} />
          <Metric label={t(locale, 'battleStyle')} value={translateContent(regulation.battleStyle, locale)} />
          <Metric label={t(locale, 'megaEvolution')} value={regulation.megaEvolutionAllowed ? t(locale, 'enabled') : t(locale, 'disabled')} />
        </div>
      </div>

      {regulation.warnings.length > 0 && (
        <div className="eq-champions-regulation-warning" role="note">
          {regulation.warnings.map(warning => (
            <p key={warning}>{translateContent(warning, locale)}</p>
          ))}
        </div>
      )}

      <div className="eq-champions-role-grid">
        <Metric label={t(locale, 'speedControl')} value={formatScore(regulation.roleCoverage.speedControl)} />
        <Metric label={t(locale, 'roleCompression')} value={formatScore(regulation.roleCoverage.roleCompression)} />
        <Metric label={t(locale, 'threatCoverage')} value={formatScore(regulation.roleCoverage.threatCoverage)} />
        <Metric label={t(locale, 'fieldControl')} value={formatScore(regulation.roleCoverage.fieldControl)} />
        <Metric label={t(locale, 'megaReadiness')} value={formatScore(regulation.roleCoverage.megaReadiness)} />
        <Metric label={t(locale, 'consistency')} value={formatScore(regulation.roleCoverage.consistency)} />
      </div>

      <div className="eq-champions-bottom-grid">
        <article>
          <strong>{t(locale, 'championsKeyThreats')}</strong>
          <ul>
            {regulation.threatAnswers.slice(0, 6).map(answer => (
              <ThreatAnswerItem key={answer.threat.name} answer={answer} locale={locale} />
            ))}
          </ul>
        </article>

        <article>
          <strong>{t(locale, 'requiredActions')}</strong>
          <ul>
            {regulation.recommendations.map(recommendation => (
              <li key={recommendation}>{translateContent(recommendation, locale)}</li>
            ))}
          </ul>
        </article>
      </div>

      {(regulation.metaSourcePackLabel || regulation.sourceBreakdown?.length || regulation.metaArchetypes?.length) && (
        <div className="eq-champions-source-panel">
          <div>
            <span>{t(locale, 'championsMetaSourcePack')}</span>
            <strong>{translateContent(regulation.metaSourcePackLabel ?? t(locale, 'notAvailable'), locale)}</strong>
            <p>
              {t(locale, 'sourceConfidence')}: {formatScore(regulation.metaSourceConfidence)} · {translateContent(regulation.metaSourceStatus ?? regulation.dataStatus, locale)}
            </p>
          </div>

          {Boolean(regulation.sourceBreakdown?.length) && (
            <article>
              <strong>{t(locale, 'sourceBreakdown')}</strong>
              <ul>
                {regulation.sourceBreakdown?.slice(0, 4).map(source => (
                  <li key={source.id}>
                    <span>{translateContent(source.reliability, locale)}</span>
                    <p>{translateContent(source.label, locale)}</p>
                  </li>
                ))}
              </ul>
            </article>
          )}

          {Boolean(regulation.metaArchetypes?.length) && (
            <article>
              <strong>{t(locale, 'sourceArchetypes')}</strong>
              <ul>
                {regulation.metaArchetypes?.slice(0, 4).map(archetype => (
                  <li key={archetype.id}>
                    <span>{archetype.priority}%</span>
                    <p>{translateContent(archetype.label, locale)}</p>
                  </li>
                ))}
              </ul>
            </article>
          )}
        </div>
      )}

      <div className="eq-format-tags">
        {regulation.uiTags.map(tag => (
          <span key={tag}>{translateContent(tag, locale)}</span>
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

function ThreatAnswerItem({ answer, locale }: { answer: ChampionsThreatAnswer; locale: Locale }) {
  return (
    <li>
      <strong>{answer.threat.name}</strong>
      <span>
        {translateMatchupLevel(answer.level, locale)} · {formatScore(answer.score)} · {t(locale, 'bestAnswer')}: {answer.bestAnswer ?? t(locale, 'noClearAnswer')}
      </span>
    </li>
  );
}
