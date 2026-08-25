// Página pública do portal de indicação (Onda 5 / 5.3).
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/refer/$slug")({
  component: ReferPublicPage,
  head: () => ({
    meta: [
      { title: "Indicar talento — TechHire" },
      { name: "description", content: "Indique alguém para uma vaga e acompanhe o status." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Program = {
  id: string;
  public_slug: string;
  name: string;
  landing_headline: string | null;
  landing_body: string | null;
  terms_url: string | null;
};

function ReferPublicPage() {
  const { slug } = useParams({ from: "/refer/$slug" });
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tsMount] = useState(() => Date.now());

  const [form, setForm] = useState({
    referrer_name: "",
    referrer_email: "",
    candidate_name: "",
    candidate_email: "",
    candidate_phone: "",
    candidate_linkedin: "",
    relationship: "",
    notes: "",
    _hp: "",
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/refer/${encodeURIComponent(slug)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok) {
          setNotFound(true);
        } else {
          setProgram(j.program);
        }
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/refer/${encodeURIComponent(slug)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, _ts: tsMount }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "Erro ao enviar.");
      } else {
        setDone(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (notFound || !program) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Programa indisponível</h1>
            <p className="text-sm text-muted-foreground">
              O link de indicação não foi encontrado ou está inativo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-3 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Gift className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {program.landing_headline ?? program.name}
          </h1>
          {program.landing_body && (
            <p className="mx-auto max-w-lg whitespace-pre-line text-sm text-muted-foreground">
              {program.landing_body}
            </p>
          )}
        </header>

        {done ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <h2 className="text-lg font-semibold">Indicação recebida!</h2>
              <p className="text-sm text-muted-foreground">
                Obrigado por indicar. O time de recrutamento vai analisar e entrar em contato com
                você sobre os próximos passos.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
                {/* honeypot */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form._hp}
                  onChange={(e) => setForm({ ...form, _hp: e.target.value })}
                  className="absolute -left-[9999px]"
                  aria-hidden="true"
                />
                <div className="sm:col-span-2">
                  <h2 className="mb-3 text-sm font-medium text-foreground">Seus dados</h2>
                </div>
                <div className="space-y-1.5">
                  <Label>Seu nome *</Label>
                  <Input
                    required
                    value={form.referrer_name}
                    onChange={(e) => setForm({ ...form, referrer_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Seu e-mail *</Label>
                  <Input
                    type="email"
                    required
                    value={form.referrer_email}
                    onChange={(e) => setForm({ ...form, referrer_email: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-2 pt-2">
                  <h2 className="mb-3 text-sm font-medium text-foreground">
                    Quem você está indicando
                  </h2>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nome do candidato *</Label>
                  <Input
                    required
                    value={form.candidate_name}
                    onChange={(e) => setForm({ ...form, candidate_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.candidate_email}
                    onChange={(e) => setForm({ ...form, candidate_email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={form.candidate_phone}
                    onChange={(e) => setForm({ ...form, candidate_phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>LinkedIn</Label>
                  <Input
                    placeholder="https://linkedin.com/in/..."
                    value={form.candidate_linkedin}
                    onChange={(e) => setForm({ ...form, candidate_linkedin: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Como vocês se conhecem?</Label>
                  <Input
                    value={form.relationship}
                    onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Por que recomenda?</Label>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>

                {error && (
                  <div className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-2">
                  {program.terms_url ? (
                    <a
                      href={program.terms_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground underline"
                    >
                      Termos do programa
                    </a>
                  ) : (
                    <span />
                  )}
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Enviando..." : "Enviar indicação"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
