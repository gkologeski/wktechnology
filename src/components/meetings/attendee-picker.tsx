import { useEffect, useRef, useState } from "react";
import { Mail, User, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { isEmail } from "@/lib/validators";

export type Attendee = { email: string; name?: string; contact_id?: string };

type Match = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

function sanitizeOrTerm(q: string) {
  return q.replace(/[,()%]/g, " ").trim();
}
function fullName(m: Pick<Match, "first_name" | "last_name">) {
  return [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
}

export function AttendeePicker({
  value,
  onChange,
  placeholder = "Buscar contato por nome/email ou digitar e-mail",
}: {
  value: Attendee[];
  onChange: (v: Attendee[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      const term = sanitizeOrTerm(q);
      if (term.length < 2) return setMatches([]);
      const tokens = term.split(/\s+/).filter((t) => t.length >= 2);
      const cols = ["first_name", "last_name", "email"];
      let query = supabase.from("contacts").select("id, first_name, last_name, email");
      for (const tok of tokens) {
        const like = `%${tok}%`;
        query = query.or(cols.map((c) => `${c}.ilike.${like}`).join(","));
      }
      const { data, error } = await query.limit(8);
      if (error) return;
      setMatches((data ?? []) as Match[]);
    }, 250);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const add = (a: Attendee) => {
    if (!a.email) return;
    const email = a.email.trim().toLowerCase();
    if (!isEmail(email)) return;
    if (value.some((v) => v.email.toLowerCase() === email)) {
      setText("");
      return;
    }
    onChange([...value, { ...a, email }]);
    setText("");
    setMatches([]);
  };

  const remove = (email: string) => {
    onChange(value.filter((v) => v.email !== email));
  };

  const commitFree = () => {
    const t = text.trim().replace(/[,;]+$/, "");
    if (!t) return;
    if (isEmail(t)) add({ email: t });
  };

  return (
    <div ref={wrapRef} className="relative space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((a) => (
            <Badge key={a.email} variant="secondary" className="gap-1 pr-1">
              {a.contact_id ? <User className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
              <span className="max-w-[200px] truncate">
                {a.name ? `${a.name} <${a.email}>` : a.email}
              </span>
              <button
                type="button"
                aria-label="Remover"
                onClick={() => remove(a.email)}
                className="ml-0.5 rounded p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
            if (text.trim()) {
              e.preventDefault();
              commitFree();
            }
          } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (text.trim() && isEmail(text.trim())) commitFree();
        }}
        placeholder={placeholder}
      />
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {matches.map((m) => {
            const name = fullName(m) || m.email || "(sem nome)";
            if (!m.email) return null;
            const already = value.some((v) => v.email.toLowerCase() === m.email!.toLowerCase());
            return (
              <button
                type="button"
                key={m.id}
                disabled={already}
                onClick={() =>
                  add({ email: m.email!, name: fullName(m) || undefined, contact_id: m.id })
                }
                className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <User className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{name}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{m.email}</span>
                </span>
                {already && (
                  <span className="ml-auto text-[10px] text-muted-foreground">adicionado</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
