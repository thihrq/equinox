import type { ReactNode } from 'react';

interface HeroProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function Hero({ title, description, children }: HeroProps) {
  return (
    <section className="eq-ds-hero">
      <h2 className="eq-ds-hero__title">{title}</h2>
      {description ? <p className="eq-ds-hero__description">{description}</p> : null}
      {children ? <div className="eq-ds-hero__content">{children}</div> : null}
    </section>
  );
}
