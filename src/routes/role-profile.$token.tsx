// Página pública do cliente: complementa/valida somente campos liberados do perfil de vaga.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MODALITY_LABEL, SENIORITY_LABEL, type ClientField } from "@/lib/role-profiles/schema";

export const Route = createFileRoute("/role-profile/$token")({
  head: () => ({
    meta: [
      { title: "Perfil de vaga — validação do cliente" },
      {
        name: "description",
        content: "Revise e complemente as informações do perfil de vaga solicitado.",
      },
      { property: "og:title", content: "Perfil de vaga — validação do cliente" },
      {
        property: "og:description",
        content: "Revise e complemente as informações do perfil de vaga solicitado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ClientRoleProfilePage,
});

type View = {
  workspaceName: string | null;
  expiresAt: string;
  view: {
    title: string;
    quantity: number;
    modality: keyof typeof MODALITY_LABEL;
    seniority: string | null;
    fields: { key: ClientField; label: string; value: unknown }[];
  };
};

const LIST_FIELDS = new Set([
  "requirements.skills",
  "requirements.languages",
  "requirements.certifications",
  "selection.stages",
]);
const NUM_FIELDS = new Set([
  "hunting.salary_min",
  "hunting.salary_max",
  "outsourcing.hours_per_week",
]);
const ENUMS: Partial<Record<ClientField, Record<string, string>>> = {
  "conditions.work_mode": { remote: "Remoto", hybrid: "Híbrido", onsite: "Presencial" },
  "outsourcing.dedication": { full: "Integral", partial: "Parcial" },
  "hunting.hiring_regime": { clt: "CLT", pj: "PJ", cooperado: "Cooperado", outro: "Outro" },
  "hunting.salary_currency": { BRL: "BRL", USD: "USD", EUR: "EUR" },
  "hunting.salary_period": { month: "Mensal", year: "Anual" },
};

const toText = (key: string, v: unknown): string => {
  if (v == null) return "";
  if (Array.isArray(v))
    return v
      .map((x) =>
        typeof x === "string"
          ? x
          : `${(x as { name: string }).name}${(x as { kind?: string }).kind === "desired" ? " (desejável)" : ""}`,
      )
      .join("\n");
  return String(v);
};
const fromText = (key: string, t: string): unknown => {
  if (LIST_FIELDS.has(key)) {
    const lines = t
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (key === "selection.stages") return lines;
    return lines.map((l) => ({
      name: l.replace(/\s*\(desejável\)$/i, ""),
      kind: /\(desejável\)$/i.test(l) ? "desired" : "required",
    }));
  }
  if (NUM_FIELDS.has(key)) return t === "" ? undefined : Number(t);
  return t;
};

function ClientRoleProfilePage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<{ loading: boolean; error?: string; data?: View }>({
    loading: true,
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/public/role-profile/${encodeURIComponent(token)}`)
      .then(async (r) => ({ ok: r.ok, j: (await r.json()) as View & { error?: string } }))
      .then(({ ok, j }) => {
        if (!alive) return;
        if (!ok) return setState({ loading: false, error: j.error ?? "Link indisponível." });
        setState({ loading: false, data: j });
        setValues(Object.fromEntries(j.view.fields.map((f) => [f.key, toText(f.key, f.value)])));
      })
      .catch(
        () =>
          alive &&
          setState({ loading: false, error: "Não foi possível carregar. Verifique sua conexão." }),
      );
    return () => {
      alive = false;
    };
  }, [token]);

  async function submit() {
    if (!state.data) return;
    setSending(true);
    setSendError(null);
    const changes: Record<string, unknown> = {};
    for (const f of state.data.view.fields) {
      const now = values[f.key] ?? "";
      if (now !== toText(f.key, f.value)) changes[f.key] = fromText(f.key, now);
    }
    let attachment: { filename: string; base64: string } | undefined;
    if (file) {
      const b64 = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] ?? "");
        r.readAsDataURL(file);
      });
      attachment = { filename: file.name, base64: b64 };
    }
    try {
      const r = await fetch(`/api/public/role-profile/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, confirm, attachment }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Falha ao enviar.");
      setDone(true);
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-product-canvas px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-xl border border-border-subtle bg-card p-6 shadow-sm">
        {state.loading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando…
          </p>
        ) : state.error || !state.data ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ShieldAlert className="h-8 w-8 text-text-tertiary" aria-hidden />
            <h1 className="text-lg font-semibold text-text-primary">{state.error}</h1>
            <p className="text-sm text-text-secondary">
              Peça um novo link ao seu contato comercial.
            </p>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center" role="status">
            <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
            <h1 className="text-lg font-semibold text-text-primary">
              Obrigado! Recebemos suas informações.
            </h1>
            <p className="text-sm text-text-secondary">
              A equipe vai revisar antes de atualizar o perfil.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-text-tertiary">
              {state.data.workspaceName ?? "Perfil de vaga"}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-text-primary">
              {state.data.view.title}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {MODALITY_LABEL[state.data.view.modality]} · {state.data.view.quantity}{" "}
              {state.data.view.quantity === 1 ? "posição" : "posições"}
              {state.data.view.seniority
                ? ` · ${SENIORITY_LABEL[state.data.view.seniority as keyof typeof SENIORITY_LABEL] ?? state.data.view.seniority}`
                : ""}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              Link válido até {new Date(state.data.expiresAt).toLocaleDateString("pt-BR")}.
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {state.data.view.fields.map((f) => {
                const opts = ENUMS[f.key];
                const id = `f-${f.key.replace(/\./g, "-")}`;
                return (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={id}>{f.label}</Label>
                    {opts ? (
                      <select
                        id={id}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      >
                        <option value="">Não informado</option>
                        {Object.entries(opts).map(([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        ))}
                      </select>
                    ) : LIST_FIELDS.has(f.key) ? (
                      <>
                        <Textarea
                          id={id}
                          rows={4}
                          value={values[f.key] ?? ""}
                          onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                        />
                        <p className="text-[11px] text-text-tertiary">
                          Um item por linha. Adicione “(desejável)” ao final quando não for
                          obrigatório.
                        </p>
                      </>
                    ) : NUM_FIELDS.has(f.key) ? (
                      <Input
                        id={id}
                        type="number"
                        min={0}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      />
                    ) : f.key === "conditions.start_date" ? (
                      <Input
                        id={id}
                        type="date"
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      />
                    ) : (
                      <Textarea
                        id={id}
                        rows={2}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      />
                    )}
                  </div>
                );
              })}
              <div className="space-y-1.5">
                <Label htmlFor="f-file">Anexo (opcional — PDF, DOCX ou imagem até 10 MB)</Label>
                <Input
                  id="f-file"
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="f-confirm"
                  checked={confirm}
                  onCheckedChange={(v) => setConfirm(!!v)}
                />
                <Label htmlFor="f-confirm" className="text-sm font-normal">
                  Confirmo que as informações acima estão corretas
                </Label>
              </div>
              {sendError ? (
                <p role="alert" className="text-sm text-destructive">
                  {sendError}
                </p>
              ) : null}
              <Button type="submit" disabled={sending}>
                {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}
                Enviar para revisão
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
