import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { Locale } from '../../i18n/equinoxI18n';
import type { SuggestedPokemon } from '../../types/equinox';

interface ShowdownExportProps {
  team: SuggestedPokemon[];
  locale: Locale;
}

export function ShowdownExport({ team, locale }: ShowdownExportProps) {
  const [copied, setCopied] = useState(false);

  const getShowdownText = () => {
    return team
      .map(p => {
        const itemSuffix = p.item && p.item !== 'Nenhum' && p.item !== 'None' ? ` @ ${p.item}` : '';
        const ability = p.ability && p.ability !== 'Nenhum' && p.ability !== 'None' ? `Ability: ${p.ability}\n` : '';
        const nature = p.nature ? `${p.nature} Nature\n` : '';
        const moves = p.moves && p.moves.length > 0
          ? p.moves.map(m => `- ${m}`).join('\n') + '\n'
          : '';
        return `${p.name}${itemSuffix}\n${ability}${nature}${moves}`;
      })
      .join('\n');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getShowdownText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const title = locale === 'pt-BR' ? 'Exportar Time Completo (Showdown)' : 'Export Full Team (Showdown)';
  const copyLabel = locale === 'pt-BR' ? 'Copiar Showdown' : 'Copy Showdown';
  const copiedLabel = locale === 'pt-BR' ? 'Copiado!' : 'Copied!';

  return (
    <section className="eq-showdown-export" style={{
      marginTop: '24px',
      padding: '20px',
      border: '1px solid var(--eq-border)',
      borderRadius: '20px',
      background: 'var(--eq-surface-soft)',
      display: 'grid',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{title}</h4>
        <button
          onClick={handleCopy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: copied ? 'var(--eq-success-soft, #10b981)' : 'var(--eq-border)',
            color: 'var(--eq-text)',
            border: 'none',
            borderRadius: '999px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: '12px',
        background: 'var(--eq-surface)',
        borderRadius: '12px',
        fontSize: '12px',
        color: 'var(--eq-text)',
        fontFamily: 'monospace',
        overflowX: 'auto',
        maxHeight: '180px',
        border: '1px solid var(--eq-border)',
        lineHeight: 1.5
      }}>
        {getShowdownText()}
      </pre>
    </section>
  );
}
