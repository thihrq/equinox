import type { Locale } from '../../i18n/equinoxI18n';

interface EquinoxMeterProps {
  label: string;
  /** Percentual a favor do jogador, de 0 a 100. */
  value: number;
  locale: Locale;
  /** Diferença (em pontos) a partir da qual o resultado deixa de ser "equilibrado". */
  balancedThreshold?: number;
}

/**
 * O medidor do equinócio.
 *
 * Uma barra que enche da esquerda para a direita responde "quanto?". Em VGC a
 * pergunta é "a favor de quem?" — então o medidor ancora no centro e cresce
 * para o lado que está ganhando. Dourado é o seu lado, violeta é o do oponente,
 * seguindo a mesma regra semântica do resto da interface.
 */
export function EquinoxMeter({ label, value, locale, balancedThreshold = 6 }: EquinoxMeterProps) {
  const yours = Math.max(0, Math.min(100, Math.round(value)));
  const opponent = 100 - yours;
  const advantage = yours - 50;
  const magnitude = Math.min(50, Math.abs(advantage));

  const balanced = Math.abs(advantage) < balancedThreshold;
  const favoursPlayer = advantage >= 0;

  const verdict = balanced
    ? locale === 'pt-BR' ? 'equilibrado' : 'balanced'
    : favoursPlayer
      ? locale === 'pt-BR' ? 'vantagem sua' : 'your advantage'
      : locale === 'pt-BR' ? 'você cede aqui' : 'you concede here';

  const verdictClass = balanced ? 'is-balanced' : favoursPlayer ? 'is-favourable' : 'is-adverse';
  const offset = `${magnitude}%`;

  return (
    <div className="eq-meter">
      <div className="eq-meter-head">
        <span className="eq-meter-label">{label}</span>
        <span className={`eq-meter-verdict ${verdictClass}`}>{verdict}</span>
      </div>

      <div
        className="eq-meter-scale"
        role="meter"
        aria-valuenow={yours}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${yours} ${locale === 'pt-BR' ? 'contra' : 'versus'} ${opponent}`}
      >
        <span className="eq-meter-track" />
        <span className="eq-meter-center" />
        <span
          className={`eq-meter-fill ${favoursPlayer ? 'is-player' : 'is-opponent'}`}
          style={favoursPlayer ? { left: '50%', width: offset } : { right: '50%', width: offset }}
        />
        <span
          className="eq-meter-pin"
          style={favoursPlayer ? { left: `calc(50% + ${offset})` } : { right: `calc(50% + ${offset})` }}
        />
      </div>

      <div className="eq-meter-legend">
        <span>{locale === 'pt-BR' ? 'Oponente' : 'Opponent'} {opponent}</span>
        <span>{yours} {locale === 'pt-BR' ? 'Você' : 'You'}</span>
      </div>
    </div>
  );
}
