import type { HTMLAttributes, ReactNode } from 'react';

interface EQMetricProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

export function EQMetric({ label, value, hint, className = '', ...props }: EQMetricProps) {
  return (
    <div className={['eq-ds-metric', className].filter(Boolean).join(' ')} {...props}>
      <p className="eq-ds-metric__label">{label}</p>
      <p className="eq-ds-metric__value">{value}</p>
      {hint ? <p className="eq-ds-metric__hint">{hint}</p> : null}
    </div>
  );
}
