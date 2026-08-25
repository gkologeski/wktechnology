import { useEffect, useRef, useState } from "react";
import { Plus, User, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ContactPickerValue = { id: string | null; name: string };

type Match = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
};

// Remove caracteres que quebram o filtro .or() do PostgREST
function sanitizeOrTerm(q: string) {
  return q.replace(/[,()%]/g, " ").trim();
}

function fullName(m: Pick<Match, "first_name" | "last_name">) {
  return [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
}

export interface ContactPickerProps {
  /**
   * "pick_or_create": permite texto livre.
   * "pick": só permite selecionar contato existente.
   */
  mode?: "pick" | "pick_or_create";
  value: ContactPickerValue;
  onChange: (v: ContactPickerValue) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Emitir toast quando matches aparecem. */
  toastOnMatches?: boolean;
  /** Buscar o nome quando recebemos só o id. Default: true. */
  hydrateById?: boolean;
  id?: string;
  className?: string;
}

export function ContactPicker({
  mode = "pick_or_create",
  value,
  onChange,
  placeholder = "Buscar ou criar",
  disabled,
  autoFocus,
  toastOnMatches = false,
  hydrateById = true,
  id,
  className,
}: ContactPickerProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const lastSearchedRef = useRef<string>("");
  const reqIdRef = useRef(0);

  // Hidrata nome quando recebemos só o id.
  useEffect(() => {
    if (!hydrateById) return;
    if (!value.id || value.name) return;
    let cancel = false;
    (async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("id", value.id!)
        .maybeSingle();
      if (cancel || error || !data) return;
      onChange({ id: data.id as string, name: fullName(data as Match) });
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.id, hydrateById]);

  // Busca a partir de 2 caracteres em nome, email, telefone ou celular.
  // Faz um único round-trip com OR amplo (rápido, usa índices trigram)
  // e refina em memória para exigir todos os tokens (AND).
  useEffect(() => {
    const q = value.name.trim();
    if (value.id) {
      setMatches([]);
      setLoading(false);
      return;
    }
    if (q.length < 2) {
      setMatches([]);
      setLoading(false);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const term = sanitizeOrTerm(q);
      if (term.length < 2) {
        if (reqId === reqIdRef.current) {
          setMatches([]);
          setLoading(false);
        }
        return;
      }
      const tokens = term.split(/\s+/).filter(Boolean);
      const cols = ["first_name", "last_name", "email", "phone", "mobile_phone"];
      const ors: string[] = [];
      ors.push(...cols.map((c) => `${c}.ilike.%${term}%`));
      for (const tok of tokens) {
        for (const c of cols) ors.push(`${c}.ilike.%${tok}%`);
      }
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, mobile_phone")
        .or(ors.join(","))
        .limit(50);
      if (reqId !== reqIdRef.current) return;
      setLoading(false);
      if (error) {
        setMatches([]);
        return;
      }
      let rows = (data ?? []) as Match[];
      const lowerTokens = tokens.map((t) => t.toLowerCase());
      rows = rows.filter((r) => {
        const hay = [r.first_name, r.last_name, r.email, r.phone, r.mobile_phone]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase())
          .join(" ");
        return lowerTokens.every((tok) => hay.includes(tok));
      });
      const lowerTerm = term.toLowerCase();
      const score = (r: Match) => {
        const name = fullName(r).toLowerCase();
        const email = (r.email ?? "").toLowerCase();
        if (name.startsWith(lowerTerm)) return 0;
        if (name.includes(lowerTerm)) return 1;
        if (email.startsWith(lowerTerm)) return 2;
        if (email.includes(lowerTerm)) return 3;
        return 4;
      };
      rows.sort((a, b) => {
        const sa = score(a);
        const sb = score(b);
        if (sa !== sb) return sa - sb;
        return fullName(a).localeCompare(fullName(b));
      });
      rows = rows.slice(0, 20);
      setMatches(rows);
      if (toastOnMatches && rows.length > 0 && lastSearchedRef.current !== q) {
        lastSearchedRef.current = q;
        toast.info(
          rows.length === 1
            ? `1 contato parecido encontrado: ${fullName(rows[0]) || rows[0].email || ""}`
            : `${rows.length} contatos parecidos encontrados`,
          { description: "Clique em um para reutilizar." },
        );
      } else if (rows.length === 0) {
        lastSearchedRef.current = q;
      }
    }, 180);
    return () => clearTimeout(t);
  }, [value.name, value.id, toastOnMatches]);

  const handleType = (text: string) => {
    if (value.id) {
      onChange({ id: null, name: text });
    } else {
      onChange({ id: value.id, name: text });
    }
  };

  const select = (m: Match) => {
    const name = fullName(m) || m.email || "";
    onChange({ id: m.id, name });
    setMatches([]);
    lastSearchedRef.current = name;
  };

  const clear = () => {
    onChange({ id: null, name: "" });
    setMatches([]);
    lastSearchedRef.current = "";
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative">
        <Input
          id={id}
          value={value.name}
          onChange={(e) => handleType(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        {(value.id || value.name) && !disabled && (
          <button
            type="button"
            aria-label="Limpar"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {value.id && (
        <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs">
          <User className="h-3.5 w-3.5 text-primary" />
          <span className="truncate">
            Vinculado a <strong>{value.name}</strong>
          </span>
        </div>
      )}

      {matches.length > 0 && (
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Contatos parecidos
          </p>
          {matches.map((m) => {
            const name = fullName(m) || "(sem nome)";
            const phone = m.phone || m.mobile_phone;
            const meta = [m.email, phone].filter(Boolean).join(" · ");
            return (
              <Button
                key={m.id}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start gap-2 px-2 py-1 text-sm font-normal"
                onClick={() => select(m)}
              >
                <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-col items-start">
                  <span className="truncate">{name}</span>
                  {meta && (
                    <span className="truncate text-[11px] text-muted-foreground">{meta}</span>
                  )}
                </span>
              </Button>
            );
          })}
        </div>
      )}

      {loading && value.name.trim().length >= 2 && !value.id && (
        <p className="text-[11px] text-muted-foreground">Buscando…</p>
      )}

      {mode === "pick" &&
        !value.id &&
        value.name.trim().length >= 2 &&
        !loading &&
        matches.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Nenhum contato encontrado. Selecione um existente.
          </p>
        )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * ContactPickerById — wrapper para callers que só guardam o id.
 * Mantém o nome localmente; hidrata via id quando necessário.
 * ───────────────────────────────────────────────────────────── */
export interface ContactPickerByIdProps extends Omit<
  ContactPickerProps,
  "value" | "onChange" | "id"
> {
  id: string | null;
  onChange: (id: string | null) => void;
}

export function ContactPickerById({ id, onChange, ...rest }: ContactPickerByIdProps) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (!id) setName("");
  }, [id]);
  return (
    <ContactPicker
      {...rest}
      value={{ id, name }}
      onChange={(v) => {
        setName(v.name);
        onChange(v.id);
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
 * ContactPickerPopover — gatilho "+ Adicionar" estilo AddAssociation,
 * abrindo um popover com ContactPicker e opção "Criar novo".
 * ───────────────────────────────────────────────────────────── */
export interface ContactPickerPopoverProps {
  onPick: (id: string) => unknown | Promise<unknown>;
  onCreateNew?: () => void;
  placeholder?: string;
  label?: string;
}

export function ContactPickerPopover({
  onPick,
  onCreateNew,
  placeholder = "Buscar contato…",
  label,
}: ContactPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {label ?? "Adicionar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 space-y-2" align="end">
        <ContactPickerById
          mode="pick"
          id={null}
          onChange={async (id) => {
            if (id) {
              await onPick(id);
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          autoFocus
        />
        {onCreateNew && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setOpen(false);
              onCreateNew();
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Criar novo
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
