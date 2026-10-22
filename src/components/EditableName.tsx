import { useEffect, useState } from "react";
// Keep the in-progress text separate from Zod's trimmed saved value.
export function EditableName({
  value,
  onCommit,
  label,
  className,
}: {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  className: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  function commit() {
    const name = draft.trim();
    if (name) {
      onCommit(name);
      setDraft(name);
    } else setDraft(value);
    setEditing(false);
  }
  return (
    <input
      className={className}
      aria-label={label}
      value={draft}
      maxLength={80}
      onFocus={() => setEditing(true)}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value.trim()) onCommit(e.target.value.trim());
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
