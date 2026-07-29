import { useState, KeyboardEvent, ClipboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Input com chips: usuário digita e pressiona Enter/Tab/vírgula para adicionar.
 * Aceita colar listas separadas por vírgula, ponto-e-vírgula ou quebra de linha.
 */
export function MultiSelectChips({ value, onChange, placeholder, className, disabled }: Props) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const parts = raw
      .split(/[,;\n\t]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = Array.from(new Set([...value, ...parts]));
    onChange(next);
    setDraft("");
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      if (draft.trim()) {
        e.preventDefault();
        commit(draft);
      }
    } else if (e.key === "Backspace" && !draft && value.length) {
      remove(value.length - 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (/[,;\n]/.test(text)) {
      e.preventDefault();
      commit(text);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 min-h-9 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "opacity-60 pointer-events-none",
        className,
      )}
    >
      {value.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground px-2 py-0.5 text-xs"
        >
          {v}
          <button
            type="button"
            aria-label={`Remover ${v}`}
            className="hover:text-destructive"
            onClick={() => remove(i)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[100px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={value.length === 0 ? placeholder : ""}
        disabled={disabled}
      />
    </div>
  );
}
