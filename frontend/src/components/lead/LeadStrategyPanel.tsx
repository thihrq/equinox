import React from 'react';
import type { Locale } from '../../i18n/equinoxI18n';
import type { LeadSuggestionResult, LeadStrategyResult } from '../../types/lead';
import { LeadPlaybookPanel } from './LeadPlaybookPanel';
import { CompetitiveTeamGrid } from '../pokemon/CompetitiveTeamGrid';
import { CompetitiveTeamExport } from '../pokemon/CompetitiveTeamExport';

interface LeadStrategyPanelProps {
  result: LeadSuggestionResult;
  locale: Locale;
  activeStrategyIndex: number;
  setActiveStrategyIndex: (idx: number) => void;
  activeQuartetIndex: number;
  setActiveQuartetIndex: (idx: number) => void;
}

const humanize = (raw: string) => raw.replace(/_/g, ' ');

export const LeadStrategyPanel: React.FC<LeadStrategyPanelProps> = ({
  result,
  locale,
  activeStrategyIndex,
  setActiveStrategyIndex,
  activeQuartetIndex,
  setActiveQuartetIndex,
}) => {
  const { leadProfile, strategies, warnings } = result;

  const activeStrategyResult: LeadStrategyResult | undefined = strategies[activeStrategyIndex];
  const activeFullTeam = activeStrategyResult?.completions[0]?.fullTeam ?? [];
  const activeQuartet = activeStrategyResult?.quartets[activeQuartetIndex]?.selectedFour;

  const none = locale === 'pt-BR' ? 'Nenhum' : 'None';

  const getSpeedAxisLabel = (axis: string) => {
    if (locale === 'pt-BR') {
      switch (axis) {
        case 'fast': return 'Alta Velocidade (Fast)';
        case 'slow': return 'Trick Room (Slow)';
        case 'hybrid': return 'Híbrido (Hybrid)';
        default: return 'Neutro';
      }
    }
    return axis.charAt(0).toUpperCase() + axis.slice(1);
  };

  const formatScore = (val: number) => val.toFixed(0);

  return (
    <div className="eq-lead-strategy-panel">
      {/* ─── 1. Perfil de Capacidades da Lead ─── */}
      <div className="eq-analysis-card">
        <h3 className="eq-section-title-v3">
          {locale === 'pt-BR' ? 'Perfil de Capacidades da Lead' : 'Lead Capability Profile'}
        </h3>
        <p className="eq-section-desc-v3" style={{ marginBottom: '16px' }}>
          {locale === 'pt-BR'
            ? 'Análise mecânica de abertura baseada no par selecionado.'
            : 'Mechanical opening analysis based on the selected pair.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Climas e Velocidade */}
          <div className="eq-detail-grid">
            <div className="eq-detail-metric">
              <strong>{locale === 'pt-BR' ? 'Climas Ativos' : 'Active Weathers'}</strong>
              <div className="eq-detail-metric__row">
                {leadProfile.weather.length > 0 ? (
                  leadProfile.weather.map(w => (
                    <span key={`${w.family}-${w.setter}`} className="eq-tag-v3 eq-tag-v3--primary" style={{ textTransform: 'capitalize' }}>
                      ☀️ {w.family} ({w.setter})
                    </span>
                  ))
                ) : (
                  <span className="eq-tag-v3 eq-tag-v3--neutral">{none}</span>
                )}
              </div>
            </div>

            <div className="eq-detail-metric">
              <strong>{locale === 'pt-BR' ? 'Controle de Velocidade' : 'Speed Control'}</strong>
              <div className="eq-detail-metric__row">
                {leadProfile.speedControl.length > 0 ? (
                  leadProfile.speedControl.map(s => (
                    <span key={`${s.type}-${s.source}`} className="eq-tag-v3 eq-tag-v3--accent" style={{ textTransform: 'capitalize' }}>
                      ⚡ {humanize(s.type)} ({s.source})
                    </span>
                  ))
                ) : (
                  <span className="eq-tag-v3 eq-tag-v3--neutral">{none}</span>
                )}
              </div>
            </div>
          </div>

          {/* Proteções e Sinergias */}
          <div className="eq-detail-grid">
            <div className="eq-detail-metric">
              <strong>{locale === 'pt-BR' ? 'Utilitários e Proteções' : 'Utilities & Protection'}</strong>
              <div className="eq-detail-metric__row">
                {leadProfile.protection.length > 0 ? (
                  leadProfile.protection.map(p => (
                    <span key={`${p.type}-${p.source}`} className="eq-tag-v3 eq-tag-v3--success" style={{ textTransform: 'capitalize' }}>
                      🛡️ {humanize(p.type)}
                    </span>
                  ))
                ) : (
                  <span className="eq-tag-v3 eq-tag-v3--neutral">{none}</span>
                )}
              </div>
            </div>

            <div className="eq-detail-metric">
              <strong>{locale === 'pt-BR' ? 'Sinergias Cobertas' : 'Covered Synergies'}</strong>
              <div className="eq-detail-metric__list">
                {leadProfile.defensiveSynergies.length > 0 ? (
                  leadProfile.defensiveSynergies.map((s, idx) => (
                    <small key={idx}>🤝 {s.description}</small>
                  ))
                ) : (
                  <span className="eq-tag-v3 eq-tag-v3--neutral" style={{ alignSelf: 'flex-start' }}>{none}</span>
                )}
              </div>
            </div>
          </div>

          {/* Avisos ou Conflitos */}
          {leadProfile.conflicts.length > 0 && (
            <div className="eq-alert-v3 eq-alert-v3--warning">
              <strong>⚠️ {locale === 'pt-BR' ? 'Conflitos Identificados na Lead:' : 'Identified Lead Conflicts:'}</strong>
              <ul>
                {leadProfile.conflicts.map((c, idx) => (
                  <li key={idx} style={{ fontSize: '13px' }}>{c.description}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ─── 2. Abas de Seleção de Estratégia ─── */}
      <div className="eq-analysis-card">
        <h3 className="eq-section-title-v3">
          {locale === 'pt-BR' ? 'Estratégias de Equipe Disponíveis' : 'Available Team Strategies'}
        </h3>
        <p className="eq-section-desc-v3" style={{ marginBottom: '16px' }}>
          {locale === 'pt-BR'
            ? 'Escolha uma estratégia para completar o time de seis e ver o playbook.'
            : 'Select a strategy to complete the team of six and view the playbook.'}
        </p>

        {strategies.length > 0 ? (
          <div className="eq-strategy-picker">
            {strategies.map((item, idx) => (
              <button
                key={item.strategy.id}
                type="button"
                className={`eq-strategy-row ${activeStrategyIndex === idx ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveStrategyIndex(idx);
                  setActiveQuartetIndex(0);
                }}
              >
                <div style={{ flex: 1, paddingRight: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="eq-strategy-row__name">{item.strategy.name}</span>
                    <span className="eq-tag-v3 eq-tag-v3--neutral" style={{ fontSize: '11px' }}>
                      {getSpeedAxisLabel(item.strategy.speedAxis)}
                    </span>
                  </div>
                  <span className="eq-strategy-row__objective">{item.strategy.objective}</span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className="eq-strategy-row__score">{item.strategy.feasibilityScore}%</span>
                  <span className="eq-strategy-row__score-label">
                    {locale === 'pt-BR' ? 'Consistência' : 'Feasibility'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="eq-alert-v3 eq-alert-v3--warning">
            <strong>
              {locale === 'pt-BR' ? 'Nenhuma estratégia viável encontrada' : 'No viable strategy found'}
            </strong>
            {warnings.length > 0 ? (
              <ul>
                {warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>
                {locale === 'pt-BR'
                  ? 'Tente outro par de lead ou libere mais espécies permitidas — este par não gerou nenhuma composição completa de time.'
                  : "Try a different lead pair or allow more species — this pair didn't produce a complete team composition."}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ─── 3. Detalhes da Estratégia Ativa ─── */}
      {activeStrategyResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Time Completo de 6 Recomendado */}
          <div className="eq-analysis-card">
            <h3 className="eq-section-title-v3">
              {locale === 'pt-BR' ? 'Time Recomendado de 6 Pokémon' : 'Recommended 6-Pokémon Team'}
            </h3>
            <p className="eq-section-desc-v3" style={{ marginBottom: '20px' }}>
              {locale === 'pt-BR'
                ? 'Os 2 primeiros Pokémon representam sua lead fixa, os outros 4 completam a estratégia.'
                : 'The first 2 Pokémon represent your locked lead, the other 4 complete the strategy.'}
            </p>

            <CompetitiveTeamGrid
              team={activeFullTeam}
              leadNames={activeStrategyResult.strategy.lead}
              locale={locale}
            />

            <CompetitiveTeamExport
              team={activeFullTeam}
              activeQuartet={activeQuartet}
              strategy={activeStrategyResult.strategy}
              locale={locale}
            />

            {/* Avaliação do Time de 6 */}
            <div className="eq-coverage-block" style={{ marginTop: '16px' }}>
              <h4>{locale === 'pt-BR' ? 'Métricas de Cobertura da Equipe' : 'Team Coverage Metrics'}</h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Score Geral */}
                <div>
                  <div className="eq-metric-row">
                    <span style={{ fontWeight: 'bold' }}>{locale === 'pt-BR' ? 'Score Geral do Time' : 'Overall Team Score'}</span>
                    <strong>{formatScore(activeStrategyResult.teamEvaluation.overallScore)}/100</strong>
                  </div>
                  <div className="eq-metric-bar eq-metric-bar--overall">
                    <span style={{ background: 'var(--eq-color-dawn)', width: `${activeStrategyResult.teamEvaluation.overallScore}%` }} />
                  </div>
                </div>

                {/* Sub-métricas */}
                <div className="eq-metric-subgrid" style={{ marginTop: 0 }}>
                  <div>
                    <div className="eq-metric-row">
                      <span>{locale === 'pt-BR' ? 'Cobertura de Roles' : 'Role Coverage'}</span>
                      <strong>{formatScore(activeStrategyResult.teamEvaluation.roleCoverageScore)}</strong>
                    </div>
                    <div className="eq-metric-bar">
                      <span style={{ background: 'var(--eq-color-success)', width: `${activeStrategyResult.teamEvaluation.roleCoverageScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="eq-metric-row">
                      <span>{locale === 'pt-BR' ? 'Balanço Ofensivo' : 'Offensive Balance'}</span>
                      <strong>{formatScore(activeStrategyResult.teamEvaluation.offensiveBalanceScore)}</strong>
                    </div>
                    <div className="eq-metric-bar">
                      <span style={{ background: 'var(--eq-color-dawn)', width: `${activeStrategyResult.teamEvaluation.offensiveBalanceScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="eq-metric-row">
                      <span>{locale === 'pt-BR' ? 'Cobertura Defensiva' : 'Defensive Coverage'}</span>
                      <strong>{formatScore(activeStrategyResult.teamEvaluation.defensiveCoverageScore)}</strong>
                    </div>
                    <div className="eq-metric-bar">
                      <span style={{ background: 'var(--eq-color-dusk)', width: `${activeStrategyResult.teamEvaluation.defensiveCoverageScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="eq-metric-row">
                      <span>{locale === 'pt-BR' ? 'Controle de Velocidade' : 'Speed Control'}</span>
                      <strong>{formatScore(activeStrategyResult.teamEvaluation.speedControlScore)}</strong>
                    </div>
                    <div className="eq-metric-bar">
                      <span style={{ background: 'var(--eq-color-warning)', width: `${activeStrategyResult.teamEvaluation.speedControlScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pontos fortes e fracos */}
            <div className="eq-swot-grid">
              <div className="eq-swot-card eq-swot-card--good">
                <strong>✅ {locale === 'pt-BR' ? 'Pontos Fortes da Composição:' : 'Composition Strengths:'}</strong>
                <ul>
                  {activeStrategyResult.teamEvaluation.strengths.slice(0, 4).map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="eq-swot-card eq-swot-card--bad">
                <strong>⚠️ {locale === 'pt-BR' ? 'Vulnerabilidades do Time:' : 'Team Weaknesses:'}</strong>
                <ul>
                  {activeStrategyResult.teamEvaluation.weaknesses.length > 0 ? (
                    activeStrategyResult.teamEvaluation.weaknesses.slice(0, 4).map((w, idx) => (
                      <li key={idx}>
                        <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{humanize(w.type)}</span>: {w.severity} ({locale === 'pt-BR' ? 'afeta' : 'affects'} {w.exposedPokemon.join(', ')})
                      </li>
                    ))
                  ) : (
                    <li>{locale === 'pt-BR' ? 'Nenhuma fraqueza severa exposta.' : 'No severe weakness exposed.'}</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Quartetos / Variações de Banco */}
          <div className="eq-analysis-card">
            <h3 className="eq-section-title-v3">
              {locale === 'pt-BR' ? 'Variações de Banco (Quartetos VGC)' : 'Backline Variations (VGC Quartet)'}
            </h3>
            <p className="eq-section-desc-v3" style={{ marginBottom: '16px' }}>
              {locale === 'pt-BR'
                ? 'Em VGC, você escolhe 4 Pokémon dos 6. Veja os melhores quartetos com base na lead fixa.'
                : 'In VGC, you bring 4 of 6. View the best quartets keeping your fixed lead.'}
            </p>

            <div className="eq-quartet-tabs" style={{ marginBottom: '16px' }}>
              {activeStrategyResult.quartets.map((quartet, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveQuartetIndex(idx)}
                  className={`eq-tab-v3 ${activeQuartetIndex === idx ? 'is-active' : ''}`}
                >
                  {locale === 'pt-BR' ? `Opção ${idx + 1}` : `Option ${idx + 1}`} ({quartet.score} pts)
                </button>
              ))}
            </div>

            {/* Playbook do quarteto selecionado */}
            {activeStrategyResult.playbooks[activeQuartetIndex] && (
              <LeadPlaybookPanel
                playbook={activeStrategyResult.playbooks[activeQuartetIndex]}
                locale={locale}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
