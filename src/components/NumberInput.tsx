import { useEffect, useState } from "react";
export function NumberInput({
  value,
  onCommit,
  label,
  nullable = false,
  max = 1000000,
  min = 0,
}: {
  value: number | null;
  onCommit: (n: number | null) => void;
  label: string;
  nullable?: boolean;
  max?: number;
  min?: number;
}) {
  const [raw, setRaw] = useState(
    value === null ? "" : String(value).replace(".", ","),
  );
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setRaw(value === null ? "" : String(value).replace(".", ","));
    setInvalid(false);
  }, [value]);
  return (
    <div className="number-field">
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        inputMode="decimal"
        value={raw}
        placeholder={nullable ? "Não definida" : ""}
        aria-invalid={invalid}
        onChange={(event) => {
          const next = event.target.value;
          setRaw(next);
          if (!next.trim() && nullable) {
            setInvalid(false);
            onCommit(null);
            return;
          }
          const n = Number(next.replace(",", "."));
          const valid =
            !!next.trim() &&
            Number.isFinite(n) &&
            n >= min &&
            n <= max &&
            (nullable || n > 0);
          setInvalid(!valid);
          if (valid) onCommit(n);
        }}
        onBlur={() => {
          if (invalid) {
            setRaw(value === null ? "" : String(value).replace(".", ","));
            setInvalid(false);
          }
        }}
      />
      {invalid && (
        <small role="alert">
          {min > 0 ? `Use um valor entre ${min} e ${max}.` : nullable ? "Use 0 ou mais." : "Use um valor maior que 0."}
        </small>
      )}
    </div>
  );
}
