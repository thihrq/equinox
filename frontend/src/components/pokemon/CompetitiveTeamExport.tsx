import React, { useMemo, useState } from 'react';
import { Clipboard, Download, FileJson, Users } from 'lucide-react';
import type { Locale } from '../../i18n/equinoxI18n';
import type { LeadStrategyCandidate, PokemonData } from '../../types/lead';
import { downloadTextFile, hasExportBlockingIssue, toJson, toPlainText, toShowdown } from '../../utils/competitiveTeamExport';

interface CompetitiveTeamExportProps {
  team: PokemonData[];
  activeQuartet?: string[];
  strategy?: LeadStrategyCandidate;
  locale: Locale;
}

export const CompetitiveTeamExport: React.FC<CompetitiveTeamExportProps> = ({
  team,
  activeQuartet,
  strategy,
  locale,
}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const isBlocked = useMemo(() => hasExportBlockingIssue(team), [team]);
  const copyLabel = copied
    ? (locale === 'pt-BR' ? 'Copiado' : 'Copied')
    : (locale === 'pt-BR' ? 'Copiar' : 'Copy');

  const quartetTeam = activeQuartet?.length
    ? team.filter(member => activeQuartet.includes(member.name))
    : team.slice(0, 4);

  const copy = async (content: string, key: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  };

  if (isBlocked) {
    return (
      <div className="eq-alert-v3 eq-alert-v3--warning">
        {locale === 'pt-BR'
          ? 'A exportação está indisponível até que os erros de legalidade sejam resolvidos.'
          : 'Export is unavailable until legality issues are resolved.'}
      </div>
    );
  }

  return (
    <div className="eq-competitive-export" aria-label={locale === 'pt-BR' ? 'Exportação competitiva' : 'Competitive export'}>
      <button type="button" className="eq-export-action" onClick={() => copy(toShowdown(team), 'team')}>
        <Clipboard size={16} aria-hidden="true" />
        <span>{copyLabel} Showdown</span>
      </button>
      <button type="button" className="eq-export-action" onClick={() => copy(toShowdown(quartetTeam), 'quartet')}>
        <Users size={16} aria-hidden="true" />
        <span>{locale === 'pt-BR' ? 'Copiar quarteto' : 'Copy quartet'}</span>
      </button>
      <button type="button" className="eq-export-action" onClick={() => downloadTextFile(toPlainText(team), 'equinox-team.txt')}>
        <Download size={16} aria-hidden="true" />
        <span>.txt</span>
      </button>
      <button type="button" className="eq-export-action" onClick={() => copy(toJson(team, strategy), 'json')}>
        <FileJson size={16} aria-hidden="true" />
        <span>JSON</span>
      </button>
    </div>
  );
};
