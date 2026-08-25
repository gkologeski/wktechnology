import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

export type AutocompleteOption = { value: string; label: string };

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Permite adicionar termos livres que não estão na lista. */
  allowCustom?: boolean;
  emptyLabel?: string;
};

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Input com chips e sugestões: conforme o usuário digita, filtra a lista de
 * opções e permite escolher com mouse ou teclado. Opcionalmente aceita
 * valores livres fora da lista.
 */
export function AutocompleteChips({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
  allowCustom = true,
  emptyLabel = "Nenhuma opção encontrada",
}: Props) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const labelFor = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return (v: string) => map.get(v) ?? v;
  }, [options]);

  const suggestions = useMemo(() => {
    const q = normalize(draft.trim());
    const selected = new Set(value);
    return options
      .filter((o) => !selected.has(o.value))
      .filter((o) => !q || normalize(o.label).includes(q) || normalize(o.value).includes(q))
      .slice(0, 30);
  }, [options, draft, value]);

  const add = (v: string) => {
    const clean = v.trim();
    if (!clean) return;
    if (!value.includes(clean)) onChange([...value, clean]);
    setDraft("");
    setActiveIdx(0);
    setOpen(false);
    inputRef.current?.focus();
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => (suggestions.length ? (i + 1) % suggestions.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) =>
        suggestions.length ? (i - 1 + suggestions.length) % suggestions.length : 0,
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      const picked = open ? suggestions[activeIdx] : undefined;
      if (picked) {
        e.preventDefault();
        add(picked.value);
      } else if (allowCustom && draft.trim()) {
        e.preventDefault();
        add(draft);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !draft && value.length) {
      remove(value.length - 1);
    }
  };

  return (
    <Popover
      open={open && (suggestions.length > 0 || (!allowCustom && !!draft))}
      onOpenChange={setOpen}
    >
      <PopoverAnchor asChild>
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 min-h-9 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            disabled && "opacity-60 pointer-events-none",
            className,
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {value.map((v, idx) => (
            <span
              key={`${v}-${idx}`}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {labelFor(v)}
              <button
                type="button"
                aria-label={`Remover ${labelFor(v)}`}
                className="opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(idx);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={draft}
            disabled={disabled}
            onChange={(e) => {
              setDraft(e.target.value);
              setActiveIdx(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={value.length ? "" : placeholder}
            className="flex-1 min-w-[8rem] bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="p-1 w-[--radix-popover-trigger-width] max-h-64 overflow-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {suggestions.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {allowCustom ? `${emptyLabel} — pressione Enter para usar assim mesmo` : emptyLabel}
          </div>
        ) : (
          suggestions.map((o, i) => (
            <button
              key={o.value}
              type="button"
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => add(o.value)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                i === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <span className="truncate">{o.label}</span>
              {value.includes(o.value) ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
