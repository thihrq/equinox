import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Locale } from '../../i18n/equinoxI18n';
import { getPokemonTypeColor, getPokemonTypeLabel, getReadableTextOnType } from '../../utils/pokemonTypeColors';
import { getNextPokemonSpriteUrl, getPokemonSpriteUrl } from '../../utils/pokemonSprites';
import { formatMultiplier, getTeamTypeMatchup } from '../../utils/typeEffectiveness';
import type { MemberEffectiveness, TypeMatchupMember } from '../../utils/typeEffectiveness';

interface TeamTypeChartProps {
  members: TypeMatchupMember[];
  locale: Locale;
}

function MemberRow({ entry }: { entry: MemberEffectiveness }) {
  const sprite = getPokemonSpriteUrl(entry.member.name);
  const emphasis = entry.multiplier >= 4 ? 'is-critical' : entry.multiplier > 1 ? 'is-weak' : entry.multiplier === 0 ? 'is-immune' : 'is-resist';

  return (
    <li>
      {sprite && (
        <img
          src={sprite}
          alt=""
          loading="lazy"
          onError={event => {
            event.currentTarget.src = getNextPokemonSpriteUrl(entry.member.name, event.currentTarget.src);
          }}
        />
      )}
      <span>{entry.member.name}</span>
      <b className={emphasis}>{formatMultiplier(entry.multiplier)}</b>
    </li>
  );
}

/**
 * Fraqueza elemental do time inteiro.
 *
 * Os 18 tipos de ataque contra as defesas do time, ordenados por severidade —
 * quem mais machuca aparece primeiro, então a ordem carrega informação. Ao
 * focar ou passar o mouse numa coluna, mostra exatamente quais membros
 * respondem por ela.
 */
export function TeamTypeChart({ members, locale }: TeamTypeChartProps) {
  const rows = useMemo(() => getTeamTypeMatchup(members), [members]);
  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * Reposiciona o balão para não vazar pelas bordas.
   *
   * Só centralizar com translateX(-50%) quebra nas colunas das pontas, e como o
   * grid é auto-fit não há como saber em CSS qual célula inicia a linha. Medir e
   * deslocar é a única forma correta.
   */
  const placeCell = useCallback((cell: HTMLElement) => {
    const popover = cell.querySelector<HTMLElement>('.eq-type-cell-popover');
    const grid = gridRef.current;
    if (!popover || !grid) return;

    popover.style.transform = 'translateX(-50%)';
    const bounds = grid.getBoundingClientRect();
    const rect = popover.getBoundingClientRect();
    const padding = 12;
    let shift = 0;

    if (rect.left < bounds.left + padding) shift = bounds.left + padding - rect.left;
    else if (rect.right > bounds.right - padding) shift = bounds.right - padding - rect.right;

    if (shift) popover.style.transform = `translateX(calc(-50% + ${Math.round(shift)}px))`;
  }, []);

  const placePopover = useCallback(
    (event: { currentTarget: HTMLElement }) => placeCell(event.currentTarget),
    [placeCell],
  );

  /**
   * Posiciona todos os balões já na montagem e a cada redimensionamento.
   *
   * Fazer isso só no hover deixava os das colunas da ponta fora dos limites até
   * o primeiro apontamento — e, como um elemento `visibility: hidden` ainda
   * ocupa layout, isso gerava barra de rolagem horizontal na página inteira.
   */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const placeAll = () => {
      grid.querySelectorAll<HTMLElement>('.eq-type-cell').forEach(placeCell);
    };

    placeAll();
    const observer = new ResizeObserver(placeAll);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [placeCell, rows]);

  if (rows.length === 0 || members.length === 0) return null;

  const weakLabel = locale === 'pt-BR' ? 'Fraco' : 'Weak';
  const resistLabel = locale === 'pt-BR' ? 'Resiste' : 'Resists';
  const immuneLabel = locale === 'pt-BR' ? 'Imune' : 'Immune';

  return (
    <section className="eq-type-chart">
      <header className="eq-type-chart-head">
        <div>
          <h3>{locale === 'pt-BR' ? 'Fraqueza elemental do time' : 'Team elemental weakness'}</h3>
          <p>
            {locale === 'pt-BR'
              ? 'Os 18 tipos de ataque contra as defesas do time. Passe o mouse ou navegue por teclado para ver quem responde por cada coluna.'
              : 'All 18 attacking types against the team. Hover or use the keyboard to see which members account for each column.'}
          </p>
        </div>
        <div className="eq-type-chart-legend">
          <span><i className="is-weak" />{weakLabel.toLowerCase()}</span>
          <span><i className="is-resist" />{resistLabel.toLowerCase()}</span>
          <span><i className="is-immune" />{immuneLabel.toLowerCase()}</span>
        </div>
      </header>

      <div className="eq-type-chart-grid" ref={gridRef}>
        {rows.map(row => {
          const color = getPokemonTypeColor(row.type) ?? 'var(--eq-text-muted)';
          const label = getPokemonTypeLabel(row.type, locale);
          const severity = row.weak.length >= 3 ? 'high' : row.weak.length === 2 ? 'mid' : 'low';
          const summary = locale === 'pt-BR'
            ? `${label}: ${row.weak.length} fracos, ${row.resists.length} resistem, ${row.immune.length} imunes`
            : `${label}: ${row.weak.length} weak, ${row.resists.length} resist, ${row.immune.length} immune`;

          return (
            <div
              key={row.type}
              className="eq-type-cell"
              data-severity={severity}
              tabIndex={0}
              role="button"
              aria-label={summary}
              onMouseEnter={placePopover}
              onFocus={placePopover}
            >
              <span className="eq-type-cell-name">
                <i style={{ background: color }} />
                {label}
              </span>

              <span className="eq-type-cell-bar">
                {[...row.weak, ...row.resists, ...row.immune, ...row.neutral].map((entry, index) => {
                  const state = entry.multiplier === 0
                    ? 'is-immune'
                    : entry.multiplier > 1 ? 'is-weak' : entry.multiplier < 1 ? 'is-resist' : '';
                  return <i key={`${entry.member.name}-${index}`} className={state} />;
                })}
              </span>

              <span className="eq-type-cell-count">
                <b className={row.weak.length ? '' : 'is-none'}>
                  {row.weak.length} {locale === 'pt-BR' ? (row.weak.length === 1 ? 'fraco' : 'fracos') : 'weak'}
                </b>
                <span>{row.resists.length} {locale === 'pt-BR' ? 'res.' : 'res.'}</span>
              </span>

              <div className="eq-type-cell-popover" role="tooltip">
                <h5
                  style={color.startsWith('#')
                    ? { background: color, color: getReadableTextOnType(color) }
                    : undefined}
                >
                  {label}
                </h5>
                {row.weak.length === 0 && row.resists.length === 0 && row.immune.length === 0 ? (
                  <p className="eq-type-cell-empty">
                    {locale === 'pt-BR' ? 'Nenhum membro é afetado de forma especial.' : 'No member is specially affected.'}
                  </p>
                ) : (
                  <>
                    {row.weak.length > 0 && (
                      <div className="eq-type-cell-group">
                        <h6>{weakLabel}</h6>
                        <ul>{row.weak.map((entry, i) => <MemberRow key={`w-${entry.member.name}-${i}`} entry={entry} />)}</ul>
                      </div>
                    )}
                    {row.resists.length > 0 && (
                      <div className="eq-type-cell-group">
                        <h6>{resistLabel}</h6>
                        <ul>{row.resists.map((entry, i) => <MemberRow key={`r-${entry.member.name}-${i}`} entry={entry} />)}</ul>
                      </div>
                    )}
                    {row.immune.length > 0 && (
                      <div className="eq-type-cell-group">
                        <h6>{immuneLabel}</h6>
                        <ul>{row.immune.map((entry, i) => <MemberRow key={`i-${entry.member.name}-${i}`} entry={entry} />)}</ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
