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
