import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent } from '../../i18n/equinoxI18n';
import type { CoachAnalysis, SuggestedPokemon } from '../../types/equinox';

interface CoachTimelineProps {
  coach?: CoachAnalysis;
  suggestedPokemons: SuggestedPokemon[];
  locale: Locale;
}

const fallback = (pokemon: SuggestedPokemon[]) => ({
  earlyGame: [`Abra com ${pokemon[0]?.name ?? 'sua melhor opção'} para testar o ritmo da partida.`],
  midGame: [`Use ${pokemon[1]?.name ?? 'seu núcleo'} para transformar trocas neutras em vantagem.`],
  lateGame: [`Prepare ${pokemon[2]?.name ?? 'sua win condition'} para finalizar no late game.`],
  winConditions: pokemon.map(item => `${item.name} como ${item.kit.role}`),
});

export function CoachTimeline({ coach, suggestedPokemons, locale }: CoachTimelineProps) {
  const data = coach ?? fallback(suggestedPokemons);
  const winCondition = data.winConditions[0] ?? suggestedPokemons[0]?.name ?? t(locale, 'winConditionFallback');

  const steps = [
    {
      number: '01',
      title: t(locale, 'opening'),
      subtitle: t(locale, 'openingSubtitle'),
      items: data.earlyGame,
    },
    {
      number: '02',
      title: t(locale, 'control'),
      subtitle: t(locale, 'controlSubtitle'),
      items: data.midGame,
    },
    {
      number: '03',
      title: t(locale, 'finish'),
      subtitle: t(locale, 'finishSubtitle'),
      items: data.lateGame,
    },
  ];

  return (
    <section className="eq-coach-timeline-section">
      <SectionHeader title={t(locale, 'executionTitle')} eyebrow={t(locale, 'executionEyebrow')} />

      <div className="eq-coach-timeline">
        {steps.map(step => (
          <article key={step.number} className="eq-timeline-step">
            <div className="eq-timeline-marker">{step.number}</div>
            <div className="eq-timeline-content">
              <span>{step.subtitle}</span>
              <h3>{step.title}</h3>
              <ul>
                {step.items.slice(0, 3).map((item, index) => (
                  <li key={`${step.title}-${index}`}>{simplifyCoachSentence(translateContent(item, locale), locale)}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}

        <article className="eq-timeline-step eq-timeline-win">
          <div className="eq-timeline-marker">◎</div>
          <div className="eq-timeline-content">
            <span>{t(locale, 'winCondition')}</span>
            <h3>{translateContent(winCondition, locale)}</h3>
            <p>{t(locale, 'useWinCondition')}</p>
          </div>
        </article>
      </div>
    </section>
  );
}

export function SectionHeader({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <header className="eq-section-header-v3">
      {eyebrow && <span>{eyebrow}</span>}
      <h2>{title}</h2>
    </header>
  );
}

function simplifyCoachSentence(sentence: string, locale: Locale) {
  const normalized = sentence.trim();

  if (locale === 'en-US') {
    return normalized
      .replace(/^Consider opening with\s+/i, 'Open with ')
      .replace(/^Use the mid game to\s+/i, 'Use the mid game to ')
      .replace(/^Plan the endgame around\s+/i, 'Plan the endgame around ')
      .trim();
  }

  return normalized
    .replace(/^Considere\s+/i, '')
    .replace(/^Use\s+/i, 'Use ')
    .replace(/^Planeje\s+/i, 'Planeje ')
    .trim();
}
