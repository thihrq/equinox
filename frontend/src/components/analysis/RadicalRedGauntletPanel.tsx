import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent, translateMatchupLevel } from '../../i18n/equinoxI18n';
import type { RadicalRedBossReport, RadicalRedThreatReport, TeamOption } from '../../types/equinox';

interface RadicalRedGauntletPanelProps {
  option: TeamOption;
  locale: Locale;
}

const formatScore = (value?: number): string => `${Math.round(value ?? 0)}%`;

const sortBossReports = (bossReports: RadicalRedBossReport[]) =>
  [...bossReports].sort((a, b) => a.order - b.order);

export function RadicalRedGauntletPanel({ option, locale }: RadicalRedGauntletPanelProps) {
  const gauntlet = option.radicalRedGauntlet;

  if (!gauntlet) {
    return <p className="eq-muted-text">{t(locale, 'noRadicalRedGauntlet')}</p>;
  }

  const criticalThreats = gauntlet.criticalThreats.slice(0, 5);

  return (
    <section className="eq-rr-gauntlet-panel">
      <div className="eq-rr-gauntlet-hero">
        <div>
          <span>{t(locale, 'dataPack')}</span>
          <strong>{translateContent(gauntlet.label, locale)}</strong>
          <p>
            {gauntlet.version} · {translateContent(gauntlet.mode, locale).toUpperCase()} · {translateContent(gauntlet.dataStatus, locale)} · {gauntlet.sourceUpdatedAt ?? gauntlet.dataVersion}
          </p>
        </div>

        <div className="eq-rr-gauntlet-metrics">
          <Metric label={t(locale, 'gauntletAverage')} value={formatScore(gauntlet.averageBossScore)} />
          <Metric label={t(locale, 'worstBoss')} value={gauntlet.worstBoss ? `${gauntlet.worstBoss.name} · ${formatScore(gauntlet.worstBossScore)}` : formatScore(gauntlet.worstBossScore)} />
          <Metric label={t(locale, 'consistency')} value={formatScore(gauntlet.consistencyScore)} />
          <Metric label={t(locale, 'confidence')} value={formatScore(gauntlet.confidence)} />
        </div>
      </div>

      {gauntlet.warnings.length > 0 && (
        <div className="eq-rr-gauntlet-warning" role="note">
          {gauntlet.warnings.map(warning => (
            <p key={warning}>{translateContent(warning, locale)}</p>
          ))}
        </div>
      )}

      <div className="eq-rr-boss-grid">
        {sortBossReports(gauntlet.bossReports).map(boss => (
          <BossCard key={boss.id} boss={boss} locale={locale} />
        ))}
      </div>

      <div className="eq-rr-bottom-grid">
        <article>
          <strong>{t(locale, 'criticalBossThreats')}</strong>
          {criticalThreats.length === 0 ? (
            <p className="eq-muted-text">{t(locale, 'noCriticalBossThreats')}</p>
          ) : (
            <ul>
              {criticalThreats.map(threat => (
                <ThreatItem key={`${threat.threat.name}-${threat.bestAnswer.pokemon}`} threat={threat} locale={locale} />
              ))}
            </ul>
          )}
        </article>

        <article>
          <strong>{t(locale, 'requiredActions')}</strong>
          <ul>
            {gauntlet.requiredActions.map(action => (
              <li key={action}>{translateContent(action, locale)}</li>
            ))}
          </ul>
        </article>
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

function BossCard({ boss, locale }: { boss: RadicalRedBossReport; locale: Locale }) {
  const worstThreat = boss.worstVariant.worstThreat;

  return (
    <article className={`eq-rr-boss-card is-${boss.level.toLowerCase()}`}>
      <div className="eq-rr-boss-head">
        <div>
          <span>{t(locale, 'bossLine')}</span>
          <strong>{boss.name}</strong>
        </div>
        <em>{translateMatchupLevel(boss.level, locale)}</em>
      </div>

      <div className="eq-rr-boss-score">
        <b>{formatScore(boss.score)}</b>
        <span>{t(locale, 'confidenceShort')} {formatScore(boss.confidence)}</span>
      </div>

      <dl>
        <div>
          <dt>{t(locale, 'worstVariant')}</dt>
          <dd>{translateContent(boss.worstVariant.label, locale)}</dd>
        </div>
        {worstThreat && (
          <div>
            <dt>{t(locale, 'worstThreat')}</dt>
            <dd>{worstThreat.threat.name} · {t(locale, 'bestAnswer')}: {worstThreat.bestAnswer.pokemon}</dd>
          </div>
        )}
        <div>
          <dt>{t(locale, 'requiredAnswers')}</dt>
          <dd>{boss.requiredAnswers.slice(0, 3).map(item => translateContent(item, locale)).join(' · ')}</dd>
        </div>
      </dl>
    </article>
  );
}

function ThreatItem({ threat, locale }: { threat: RadicalRedThreatReport; locale: Locale }) {
  return (
    <li>
      <strong>{threat.threat.name}</strong>
      <span>{translateMatchupLevel(threat.level, locale)} · {formatScore(threat.score)} · {t(locale, 'bestAnswer')}: {threat.bestAnswer.pokemon}</span>
    </li>
  );
}
