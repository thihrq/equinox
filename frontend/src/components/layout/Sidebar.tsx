import type { ReactNode } from 'react';

interface SidebarProps {
  children?: ReactNode;
  footer?: ReactNode;
}

export function Sidebar({ children, footer }: SidebarProps) {
  return (
    <aside className="eq-ds-sidebar">
      {children}
      {footer ? <div className="eq-ds-sidebar__footer">{footer}</div> : null}
    </aside>
  );
}
