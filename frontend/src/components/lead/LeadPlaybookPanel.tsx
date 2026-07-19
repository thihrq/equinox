import React from 'react';
import type { Locale } from '../../i18n/equinoxI18n';
import type { LeadPlaybook } from '../../types/lead';

interface LeadPlaybookPanelProps {
  playbook: LeadPlaybook;
  locale: Locale;
}

export const LeadPlaybookPanel: React.FC<LeadPlaybookPanelProps> = ({
  playbook,
  locale,
}) => {
  return (
    <div className="eq-lead-playbook-panel">
      {/* Resumo do Quarteto */}
      <div className="eq-playbook-summary">
        <div className="eq-playbook-summary__head">
          <h4>{locale === 'pt-BR' ? 'Quarteto Alocado' : 'Selected Quartet'}</h4>
          <span className={`eq-tag-v3 ${playbook.contractValid ? 'eq-tag-v3--success' : 'eq-tag-v3--danger'}`}>
            {playbook.contractValid
              ? (locale === 'pt-BR' ? 'Contrato Válido' : 'Valid Contract')
              : (locale === 'pt-BR' ? 'Violação de Contrato' : 'Contract Violation')}
          </span>
        </div>

        <div className="eq-detail-grid">
          <div>
            <span className="eq-playbook-slot-label">
              {locale === 'pt-BR' ? 'Lead (Ativos Turno 1)' : 'Lead (Turn 1 Actives)'}
            </span>
            <span className="eq-tag-v3 eq-tag-v3--primary">{playbook.lead.join(' + ')}</span>
          </div>
          <div>
            <span className="eq-playbook-slot-label">
              {locale === 'pt-BR' ? 'Backline (Reservas)' : 'Backline (Bench)'}
            </span>
            <span className="eq-tag-v3 eq-tag-v3--neutral">{playbook.backline.join(' + ')}</span>
          </div>
        </div>
      </div>

      {/* Turno 1 - Instruções de Abertura */}
      <div>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--eq-text-strong)' }}>
          ⚔️ {locale === 'pt-BR' ? 'Abertura Recomendada (Turno 1)' : 'Recommended Turn 1 Plays'}
        </h4>
        <div className="eq-play-list">
          {playbook.turnOneOptions.map((play, idx) => (
            <div key={idx} className="eq-play-card">
              <div className="eq-play-card__head">
                <strong style={{ color: 'var(--eq-text-strong)', fontSize: '14px' }}>{play.pokemon}</strong>
                <span className="eq-tag-v3 eq-tag-v3--accent" style={{ fontSize: '11px' }}>
                  {play.action} {play.target ? `→ ${play.target}` : ''}
                </span>
              </div>
              <p>{play.reasoning}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rota de Transição e Pivotagem */}
      <div>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--eq-text-strong)' }}>
          🔄 {locale === 'pt-BR' ? 'Plano de Transição e Reservas' : 'Transition & Backup Strategy'}
        </h4>
        <div className="eq-play-list">
          {playbook.transitionOptions.length > 0 ? (
            playbook.transitionOptions.map((trans, idx) => (
              <div key={idx} className="eq-play-card eq-play-card--transition">
                <div className="eq-play-card__head">
                  <strong style={{ color: 'var(--eq-color-success)', fontSize: '13px' }}>
                    {locale === 'pt-BR' ? 'Gatilho: ' : 'Trigger: '} {trans.trigger}
                  </strong>
                  <span className="eq-tag-v3 eq-tag-v3--success" style={{ fontSize: '11px' }}>
                    {locale === 'pt-BR' ? 'Entra' : 'Bring in'} {trans.switchIn}
                  </span>
                </div>
                <p>{trans.reasoning}</p>
              </div>
            ))
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--eq-subtle)' }}>
              {locale === 'pt-BR'
                ? 'Nenhuma transição específica necessária. Jogue conforme a vantagem de tipos.'
                : 'No specific transitions required. Play according to type matchup.'}
            </p>
          )}
        </div>
      </div>

      {/* Condições de Vitória e Ameaças */}
      <div className="eq-win-threat-grid">
        <div>
          <h4>🏆 {locale === 'pt-BR' ? 'Condições de Vitória' : 'Win Conditions'}</h4>
          <ul>
            {playbook.winConditions.map((cond, idx) => (
              <li key={idx}>{cond}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4>⚡ {locale === 'pt-BR' ? 'Ameaças Principais' : 'Main Threats'}</h4>
          <ul>
            {playbook.threats.length > 0 ? (
              playbook.threats.map((threat, idx) => (
                <li key={idx}>{threat}</li>
              ))
            ) : (
              <li>{locale === 'pt-BR' ? 'Nenhuma ameaça óbvia identificada.' : 'No obvious threats identified.'}</li>
            )}
          </ul>
        </div>
      </div>

      {/* Matchups Desfavoráveis */}
      {playbook.avoidWhen.length > 0 && (
        <div className="eq-avoid-block">
          <strong>🚫 {locale === 'pt-BR' ? 'Evitar usar este quarteto se:' : 'Avoid this quartet if:'}</strong>
          <ul>
            {playbook.avoidWhen.map((avoid, idx) => (
              <li key={idx}>{avoid}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Facilidade de Execução */}
      <div className="eq-execution-index">
        <div>
          <span className="eq-execution-index__label">
            {locale === 'pt-BR' ? 'Índice de Consistência e Execução' : 'Execution Consistency Index'}
          </span>
          <span className="eq-execution-index__hint">
            {locale === 'pt-BR'
              ? 'Quão simples e confiável é rodar esta estratégia na partida.'
              : 'How simple and reliable this strategy is to execute in combat.'}
          </span>
        </div>
        <span className="eq-execution-index__value">{playbook.executionIndex}%</span>
      </div>
    </div>
  );
};
