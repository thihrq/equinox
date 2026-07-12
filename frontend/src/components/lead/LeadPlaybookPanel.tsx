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
    <div className="eq-lead-playbook-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Resumo do Quarteto */}
      <div style={{
        background: 'var(--eq-bg-deep)',
        border: '1px solid var(--eq-border)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--eq-text-primary)' }}>
            {locale === 'pt-BR' ? 'Quarteto Alocado' : 'Selected Quartet'}
          </h4>
          <span className={`eq-tag-v3 ${playbook.contractValid ? 'eq-tag-v3--success' : 'eq-tag-v3--danger'}`}>
            {playbook.contractValid
              ? (locale === 'pt-BR' ? 'Contrato Válido' : 'Valid Contract')
              : (locale === 'pt-BR' ? 'Violação de Contrato' : 'Contract Violation')}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <strong style={{ fontSize: '12px', color: 'var(--eq-text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>
              Lead (Ativos Turno 1)
            </strong>
            <span style={{ fontSize: '14px', color: 'var(--eq-accent)', fontWeight: 'bold' }}>
              {playbook.lead.join(' + ')}
            </span>
          </div>
          <div>
            <strong style={{ fontSize: '12px', color: 'var(--eq-text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>
              Backline (Reservas)
            </strong>
            <span style={{ fontSize: '14px', color: 'var(--eq-text-primary)' }}>
              {playbook.backline.join(' + ')}
            </span>
          </div>
        </div>
      </div>

      {/* Turno 1 - Instruções de Abertura */}
      <div>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--eq-text-primary)' }}>
          ⚔️ {locale === 'pt-BR' ? 'Abertura Recomendada (Turno 1)' : 'Recommended Turn 1 Plays'}
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {playbook.turnOneOptions.map((play, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--eq-bg-card-sub)',
                border: '1px solid var(--eq-border)',
                borderLeft: '4px solid var(--eq-accent)',
                borderRadius: '0 8px 8px 0',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <strong style={{ color: 'var(--eq-text-primary)', fontSize: '14px' }}>{play.pokemon}</strong>
                <span className="eq-tag-v3 eq-tag-v3--accent" style={{ fontSize: '11px' }}>
                  {play.action} {play.target ? `→ ${play.target}` : ''}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--eq-text-secondary)', lineHeight: '1.4' }}>
                {play.reasoning}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Rota de Transição e Pivotagem */}
      <div>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--eq-text-primary)' }}>
          🔄 {locale === 'pt-BR' ? 'Plano de Transição e Reservas' : 'Transition & Backup Strategy'}
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {playbook.transitionOptions.length > 0 ? (
            playbook.transitionOptions.map((trans, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--eq-bg-card-sub)',
                  border: '1px solid var(--eq-border)',
                  borderLeft: '4px solid var(--eq-success)',
                  borderRadius: '0 8px 8px 0',
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong style={{ color: 'var(--eq-success)', fontSize: '13px' }}>
                    {locale === 'pt-BR' ? 'Gatilho: ' : 'Trigger: '} {trans.trigger}
                  </strong>
                  <span className="eq-tag-v3 eq-tag-v3--success" style={{ fontSize: '11px' }}>
                    {locale === 'pt-BR' ? 'Entra' : 'Bring in'} {trans.switchIn}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--eq-text-secondary)', lineHeight: '1.4' }}>
                  {trans.reasoning}
                </p>
              </div>
            ))
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--eq-text-muted)' }}>
              {locale === 'pt-BR'
                ? 'Nenhuma transição específica necessária. Jogue conforme a vantagem de tipos.'
                : 'No specific transitions required. Play according to type matchup.'}
            </p>
          )}
        </div>
      </div>

      {/* Condições de Vitória e Ameaças */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--eq-text-primary)' }}>
            🏆 {locale === 'pt-BR' ? 'Condições de Vitória' : 'Win Conditions'}
          </h4>
          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '13px', color: 'var(--eq-text-secondary)', lineHeight: '1.5' }}>
            {playbook.winConditions.map((cond, idx) => (
              <li key={idx} style={{ marginBottom: '6px' }}>{cond}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--eq-text-primary)' }}>
            ⚡ {locale === 'pt-BR' ? 'Ameaças Principais' : 'Main Threats'}
          </h4>
          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '13px', color: 'var(--eq-text-secondary)', lineHeight: '1.5' }}>
            {playbook.threats.length > 0 ? (
              playbook.threats.map((threat, idx) => (
                <li key={idx} style={{ marginBottom: '6px' }}>{threat}</li>
              ))
            ) : (
              <li>{locale === 'pt-BR' ? 'Nenhuma ameaça óbvia identificada.' : 'No obvious threats identified.'}</li>
            )}
          </ul>
        </div>
      </div>

      {/* Matchups Desfavoráveis */}
      {playbook.avoidWhen.length > 0 && (
        <div style={{
          background: 'rgba(230, 126, 34, 0.05)',
          border: '1px solid rgba(230, 126, 34, 0.2)',
          borderRadius: '8px',
          padding: '12px 16px',
        }}>
          <strong style={{ color: 'var(--eq-warning)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
            🚫 {locale === 'pt-BR' ? 'Evitar usar este quarteto se:' : 'Avoid this quartet if:'}
          </strong>
          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--eq-text-secondary)' }}>
            {playbook.avoidWhen.map((avoid, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{avoid}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Facilidade de Execução */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--eq-bg-deep)',
        border: '1px solid var(--eq-border)',
        borderRadius: '8px',
        padding: '12px 16px',
      }}>
        <div>
          <strong style={{ fontSize: '14px', color: 'var(--eq-text-primary)', display: 'block' }}>
            {locale === 'pt-BR' ? 'Índice de Consistência e Execução' : 'Execution Consistency Index'}
          </strong>
          <small style={{ color: 'var(--eq-text-muted)' }}>
            {locale === 'pt-BR'
              ? 'Quão simples e confiável é rodar esta estratégia na partida.'
              : 'How simple and reliable this strategy is to execute in combat.'}
          </small>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--eq-success)' }}>
            {playbook.executionIndex}%
          </span>
        </div>
      </div>
    </div>
  );
};
