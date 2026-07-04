interface DividerProps {
  label?: string;
}

export function Divider({ label }: DividerProps) {
  if (!label) {
    return <div className="eq-ds-divider" aria-hidden="true" />;
  }

  return (
    <div className="eq-ds-divider eq-ds-divider--labeled">
      <span>{label}</span>
    </div>
  );
}
