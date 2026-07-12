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

export const LeadStrategyPanel: React.FC<LeadStrategyPanelProps> = ({
  result,
  locale,
  activeStrategyIndex,
  setActiveStrategyIndex,
  activeQuartetIndex,
  setActiveQuartetIndex,
}) => {
  const { leadProfile, strategies } = result;

  const activeStrategyResult: LeadStrategyResult | undefined = strategies[activeStrategyIndex];
  const activeFullTeam = activeStrategyResult?.completions[0]?.fullTeam ?? [];
  const activeQuartet = activeStrategyResult?.quartets[activeQuartetIndex]?.selectedFour;

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

  const formatScore = (val: number) => {
    return val.toFixed(0);
  };

  return (
    <div className="eq-lead-strategy-panel">
      {/* ─── 1. Perfil de Capacidades da Lead ─── */}
      <div className="eq-analysis-card" style={{ marginBottom: '24px' }}>
        <h3 className="eq-section-title-v3" style={{ marginTop: 0 }}>
          {locale === 'pt-BR' ? 'Perfil de Capacidades da Lead' : 'Lead Capability Profile'}
        </h3>
        <p className="eq-section-desc-v3" style={{ marginBottom: '16px' }}>
          {locale === 'pt-BR'
            ? 'Análise mecânica de abertura baseada no par selecionado.'
            : 'Mechanical opening analysis based on the selected pair.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Climas e Velocidade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="eq-detail-metric">
              <strong>{locale === 'pt-BR' ? 'Climas Ativos' : 'Active Weathers'}</strong>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                {leadProfile.weather.length > 0 ? (
                  leadProfile.weather.map(w => (
                    <span key={w.family} className="eq-tag-v3 eq-tag-v3--primary" style={{ textTransform: 'capitalize' }}>
                      ☀️ {w.family} ({w.setter})
                    </span>
                  ))
                ) : (
                  <span className="eq-tag-v3 eq-tag-v3--neutral">None</span>
                )}
              </div>
            </div>

            <div className="eq-detail-metric">
              <strong>{locale === 'pt-BR' ? 'Controle de Velocidade' : 'Speed Control'}</strong>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                {leadProfile.speedControl.length > 0 ? (
                  leadProfile.speedControl.map(s => (
                    <span key={s.type} className="eq-tag-v3 eq-tag-v3--accent" style={{ textTransform: 'capitalize' }}>
                      ⚡ {s.type} ({s.source})
                    </span>
                  ))
                ) : (
                  <span className="eq-tag-v3 eq-tag-v3--neutral">None</span>
                )}
              </div>
            </div>
          </div>

          {/* Proteções e Sinergias */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="eq-detail-metric">
              <strong>{locale === 'pt-BR' ? 'Utilitários e Proteções' : 'Utilities & Protection'}</strong>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                {leadProfile.protection.length > 0 ? (
                  leadProfile.protection.map(p => (
                    <span key={p.type} className="eq-tag-v3 eq-tag-v3--success" style={{ textTransform: 'capitalize' }}>
                      🛡️ {p.type.replace('_', ' ')}
                    </span>
                  ))
                ) : (
                  <span className="eq-tag-v3 eq-tag-v3--neutral">None</span>
                )}
              </div>
            </div>

            <div className="eq-detail-metric">
              <strong>{locale === 'pt-BR' ? 'Sinergias Cobertas' : 'Covered Synergies'}</strong>
              <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', marginTop: '6px' }}>
                {leadProfile.defensiveSynergies.length > 0 ? (
                  leadProfile.defensiveSynergies.map((s, idx) => (
                    <small key={idx} style={{ color: 'var(--eq-text-secondary)', display: 'block' }}>
                      🤝 {s.description}
                    </small>
                  ))
                ) : (
                  <span className="eq-tag-v3 eq-tag-v3--neutral" style={{ alignSelf: 'flex-start' }}>None</span>
                )}
              </div>
            </div>
          </div>

          {/* Avisos ou Conflitos */}
          {leadProfile.conflicts.length > 0 && (
            <div className="eq-alert-v3 eq-alert-v3--warning" style={{ marginTop: '8px' }}>
              <strong>⚠️ {locale === 'pt-BR' ? 'Conflitos Identificados na Lead:' : 'Identified Lead Conflicts:'}</strong>
              <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                {leadProfile.conflicts.map((c, idx) => (
                  <li key={idx} style={{ fontSize: '13px', color: 'var(--eq-text-primary)' }}>{c.description}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ─── 2. Abas de Seleção de Estratégia ─── */}
      <div className="eq-analysis-card" style={{ marginBottom: '24px' }}>
        <h3 className="eq-section-title-v3" style={{ marginTop: 0 }}>
          {locale === 'pt-BR' ? 'Estratégias de Equipe Disponíveis' : 'Available Team Strategies'}
        </h3>
        <p className="eq-section-desc-v3" style={{ marginBottom: '16px' }}>
          {locale === 'pt-BR'
            ? 'Escolha uma estratégia para completar o time de seis e ver o playbook.'
            : 'Select a strategy to complete the team of six and view the playbook.'}
        </p>

        <div className="eq-strategy-picker" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {strategies.map((item, idx) => (
            <button
              key={item.strategy.id}
              type="button"
              className={`eq-strategy-row ${activeStrategyIndex === idx ? 'is-active' : ''}`}
              onClick={() => {
                setActiveStrategyIndex(idx);
                setActiveQuartetIndex(0);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: activeStrategyIndex === idx ? 'var(--eq-bg-active)' : 'var(--eq-bg-card-sub)',
                border: '1px solid var(--eq-border)',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ flex: 1, paddingRight: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '15px', color: 'var(--eq-text-primary)' }}>{item.strategy.name}</strong>
                  <span className="eq-tag-v3 eq-tag-v3--neutral" style={{ fontSize: '11px' }}>
                    {getSpeedAxisLabel(item.strategy.speedAxis)}
                  </span>
                </div>
                <small style={{ color: 'var(--eq-text-secondary)', display: 'block', fontSize: '13px' }}>
                  {item.strategy.objective}
                </small>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--eq-accent)' }}>
                  {item.strategy.feasibilityScore}%
                </span>
                <small style={{ display: 'block', color: 'var(--eq-text-muted)', fontSize: '11px' }}>
                  {locale === 'pt-BR' ? 'Consistência' : 'Feasibility'}
                </small>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── 3. Detalhes da Estratégia Ativa ─── */}
      {activeStrategyResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Time Completo de 6 Recomendado */}
          <div className="eq-analysis-card">
            <h3 className="eq-section-title-v3" style={{ marginTop: 0 }}>
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
            <div style={{
              background: 'var(--eq-bg-deep)',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--eq-border)',
            }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--eq-text-primary)' }}>
                {locale === 'pt-BR' ? 'Métricas de Cobertura da Equipe' : 'Team Coverage Metrics'}
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Score Geral */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                    <span style={{ fontWeight: 'bold' }}>{locale === 'pt-BR' ? 'Score Geral do Time' : 'Overall Team Score'}</span>
                    <span style={{ color: 'var(--eq-accent)', fontWeight: 900 }}>{formatScore(activeStrategyResult.teamEvaluation.overallScore)}/100</span>
                  </div>
                  <div style={{ background: 'var(--eq-border)', height: '8px', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{
                      background: 'var(--eq-accent)',
                      width: `${activeStrategyResult.teamEvaluation.overallScore}%`,
                      height: '100%',
                      borderRadius: '8px',
                    }} />
                  </div>
                </div>

                {/* Sub-métricas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                      <span>{locale === 'pt-BR' ? 'Cobertura de Roles' : 'Role Coverage'}</span>
                      <span>{formatScore(activeStrategyResult.teamEvaluation.roleCoverageScore)}</span>
                    </div>
                    <div style={{ background: 'var(--eq-border)', height: '6px', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ background: 'var(--eq-success)', width: `${activeStrategyResult.teamEvaluation.roleCoverageScore}%`, height: '100%' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                      <span>{locale === 'pt-BR' ? 'Balanço Ofensivo' : 'Offensive Balance'}</span>
                      <span>{formatScore(activeStrategyResult.teamEvaluation.offensiveBalanceScore)}</span>
                    </div>
                    <div style={{ background: 'var(--eq-border)', height: '6px', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ background: 'var(--eq-accent)', width: `${activeStrategyResult.teamEvaluation.offensiveBalanceScore}%`, height: '100%' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                      <span>{locale === 'pt-BR' ? 'Cobertura Defensiva' : 'Defensive Coverage'}</span>
                      <span>{formatScore(activeStrategyResult.teamEvaluation.defensiveCoverageScore)}</span>
                    </div>
                    <div style={{ background: 'var(--eq-border)', height: '6px', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ background: 'var(--eq-accent-dim)', width: `${activeStrategyResult.teamEvaluation.defensiveCoverageScore}%`, height: '100%' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                      <span>{locale === 'pt-BR' ? 'Controle de Velocidade' : 'Speed Control'}</span>
                      <span>{formatScore(activeStrategyResult.teamEvaluation.speedControlScore)}</span>
                    </div>
                    <div style={{ background: 'var(--eq-border)', height: '6px', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ background: 'var(--eq-warning)', width: `${activeStrategyResult.teamEvaluation.speedControlScore}%`, height: '100%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pontos fortes e fracos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
              <div style={{ background: 'rgba(46, 204, 113, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(46, 204, 113, 0.2)' }}>
                <strong style={{ color: 'var(--eq-success)', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                  ✅ {locale === 'pt-BR' ? 'Pontos Fortes da Composição:' : 'Composition Strengths:'}
                </strong>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--eq-text-secondary)' }}>
                  {activeStrategyResult.teamEvaluation.strengths.slice(0, 4).map((s, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{s}</li>
                  ))}
                </ul>
              </div>

              <div style={{ background: 'rgba(231, 76, 60, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(231, 76, 60, 0.2)' }}>
                <strong style={{ color: 'var(--eq-error)', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                  ⚠️ {locale === 'pt-BR' ? 'Vulnerabilidades do Time:' : 'Team Weaknesses:'}
                </strong>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--eq-text-secondary)' }}>
                  {activeStrategyResult.teamEvaluation.weaknesses.length > 0 ? (
                    activeStrategyResult.teamEvaluation.weaknesses.slice(0, 4).map((w, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{w.type}</span>: {w.severity} (afeta {w.exposedPokemon.join(', ')})
                      </li>
                    ))
                  ) : (
                    <li>Nenhuma fraqueza severa exposta.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Quartetos / Variações de Banco */}
          <div className="eq-analysis-card">
            <h3 className="eq-section-title-v3" style={{ marginTop: 0 }}>
              {locale === 'pt-BR' ? 'Variações de Banco (Quartetos VGC)' : 'Backline Variations (VGC Quartet)'}
            </h3>
            <p className="eq-section-desc-v3" style={{ marginBottom: '16px' }}>
              {locale === 'pt-BR'
                ? 'Em VGC, você escolhe 4 Pokémon dos 6. Veja os melhores quartetos com base na lead fixa.'
                : 'In VGC, you bring 4 of 6. View the best quartets keeping your fixed lead.'}
            </p>

            <div className="eq-quartet-tabs" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
              {activeStrategyResult.quartets.map((quartet, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveQuartetIndex(idx)}
                  className={`eq-tab-v3 ${activeQuartetIndex === idx ? 'is-active' : ''}`}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '1px solid var(--eq-border)',
                    background: activeQuartetIndex === idx ? 'var(--eq-accent)' : 'var(--eq-bg-card-sub)',
                    color: activeQuartetIndex === idx ? '#000' : 'var(--eq-text-primary)',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
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
