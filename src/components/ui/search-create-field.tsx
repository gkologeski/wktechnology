import { useId, useState } from "react";
import { Plus, X, Link2 } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";

export type SearchCreateOption = { id: string; label: string; hint?: string | null };
/** Shared visual control. Reads and creation are supplied by authorized callers. */
export function SearchCreateField({
  id,
  label,
  text,
  selectedId,
  options,
  loading,
  searched,
  error,
  disabled,
  onTextChange,
  onPick,
  onClear,
  onCreate,
  onRetry,
  onFocus,
}: {
  id?: string;
  label: string;
  text: string;
  selectedId: string | null;
  options: SearchCreateOption[];
  loading: boolean;
  searched: boolean;
  error?: string | null;
  disabled?: boolean;
  onTextChange: (text: string) => void;
  onPick: (option: SearchCreateOption) => void;
  onClear: () => void;
  onCreate?: (text: string) => void;
  onRetry?: () => void;
  onFocus?: () => void;
}) {
  const generated = useId(),
    inputId = id ?? generated,
    listId = `${inputId}-results`;
  const [active, setActive] = useState(-1),
    [dismissed, setDismissed] = useState(false);
  const visible =
    !selectedId && !dismissed && !disabled && !loading && !error && options.length > 0;
  const exact = options.some(
    (o) => o.label.trim().toLocaleLowerCase() === text.trim().toLocaleLowerCase(),
  );
  const canCreate =
    !selectedId &&
    !disabled &&
    !loading &&
    searched &&
    !error &&
    text.trim().length >= 2 &&
    !exact &&
    !!onCreate;
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          id={inputId}
          aria-label={label}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={visible}
          aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
          value={text}
          disabled={disabled}
          placeholder={`Buscar ${label.toLocaleLowerCase()}…`}
          onFocus={() => {
            setDismissed(false);
            onFocus?.();
          }}
          onChange={(e) => {
            setDismissed(false);
            setActive(-1);
            onTextChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && visible) {
              e.preventDefault();
              e.stopPropagation();
              setDismissed(true);
              setActive(-1);
            }
            if (visible && ["ArrowDown", "ArrowUp"].includes(e.key)) {
              e.preventDefault();
              setActive((i) =>
                e.key === "ArrowDown" ? Math.min(i + 1, options.length - 1) : Math.max(i - 1, 0),
              );
            }
            if (visible && e.key === "Enter" && active >= 0 && options[active]) {
              e.preventDefault();
              onPick(options[active]);
              setActive(-1);
            }
          }}
        />
        {!disabled && (selectedId || text) && (
          <button
            type="button"
            aria-label={`Limpar ${label.toLocaleLowerCase()}`}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            onClick={() => {
              setActive(-1);
              onClear();
            }}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {selectedId && (
        <p className="flex gap-2 items-center rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs">
          <Link2 className="size-3.5 shrink-0" />
          Selecionado: <strong className="truncate">{text}</strong>
        </p>
      )}
      {loading && !selectedId && (
        <p role="status" className="text-xs text-muted-foreground">
          Buscando…
        </p>
      )}
      {error && (
        <div role="alert" className="text-sm text-destructive">
          {error}
          {onRetry && (
            <Button type="button" variant="link" onClick={onRetry}>
              Tentar novamente
            </Button>
          )}
        </div>
      )}
      {visible && (
        <div
          id={listId}
          role="listbox"
          aria-label={`Resultados: ${label}`}
          className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-2 space-y-1"
        >
          {options.map((option, index) => (
            <Button
              type="button"
              role="option"
              aria-selected={active === index}
              id={`${listId}-${index}`}
              key={option.id}
              variant="ghost"
              className="h-auto w-full justify-start text-left whitespace-normal font-normal"
              onClick={() => onPick(option)}
            >
              <span>
                <span className="block">{option.label}</span>
                {option.hint && (
                  <small className="block text-muted-foreground">{option.hint}</small>
                )}
              </span>
            </Button>
          ))}
        </div>
      )}
      {!selectedId && !loading && searched && !error && !options.length && (
        <p className="text-xs text-muted-foreground">Nenhum resultado encontrado.</p>
      )}
      {canCreate && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto max-w-full whitespace-normal text-left"
          onClick={() => onCreate?.(text.trim())}
        >
          <Plus className="size-3.5 mr-1" />
          Criar {label.toLocaleLowerCase()} “{text.trim()}”
        </Button>
      )}
      {!selectedId && text.trim() && !disabled && (
        <p className="text-xs text-muted-foreground">
          {onCreate
            ? "Selecione um cadastro existente ou conclua a criação para vincular."
            : "Selecione um cadastro existente para vincular."}
        </p>
      )}
    </div>
  );
}
