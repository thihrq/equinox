import type { ReactNode } from 'react';

export interface EQTabItem<T extends string> {
  label: ReactNode;
  value: T;
}

interface EQTabsProps<T extends string> {
  items: EQTabItem<T>[];
  activeValue: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function EQTabs<T extends string>({
  items,
  activeValue,
  onChange,
  ariaLabel,
}: EQTabsProps<T>) {
  return (
    <div className="eq-ds-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map(item => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={activeValue === item.value}
          className={activeValue === item.value ? 'eq-ds-tabs__item is-active' : 'eq-ds-tabs__item'}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
