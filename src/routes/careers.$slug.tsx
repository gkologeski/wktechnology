// Página pública /careers/$slug — detalhe da vaga + formulário de candidatura.
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPublicJob, submitPublicApplication } from "@/lib/ats/public.functions";

export const Route = createFileRoute("/careers/$slug")({
  component: CareerJobPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">Vaga não encontrada</h1>
      <p className="mt-2 text-muted-foreground">
        Esta vaga pode ter sido encerrada ou despublicada.
      </p>
      <Link to="/careers" className="text-primary mt-4 inline-block">
        ← Ver outras vagas
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">Ops</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function CareerJobPage() {
  const { slug } = Route.useParams();
  const host = typeof window !== "undefined" ? window.location.host : null;
  const getter = useServerFn(getPublicJob);
  const submitter = useServerFn(submitPublicApplication);

  const query = useQuery({
    queryKey: ["public-job", host, slug],
    queryFn: async () => {
      const j = await getter({ data: { host, slug } });
      if (!j) throw notFound();
      return j;
    },
  });

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    linkedin_url: "",
    location: "",
    cv_url: "",
    message: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      submitter({
        data: {
          host,
          job_id: query.data!.id as string,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          linkedin_url: form.linkedin_url || null,
          location: form.location || null,
          cv_url: form.cv_url || null,
          message: form.message || null,
        },
      }),
    onSuccess: () => toast.success("Candidatura enviada!"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) {
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-muted-foreground">Carregando…</div>;
  }
  const job = query.data!;
  const jobAny = job as unknown as {
    id: string;
    title: string;
    description: string | null;
    requirements: string | null;
    seniority: string | null;
    employment_type: string | null;
    location: string | null;
    remote_mode: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
  };

  if (mutation.isSuccess) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold">Candidatura enviada!</h1>
        <p className="mt-2 text-muted-foreground">
          Obrigado pelo interesse na vaga <strong>{jobAny.title}</strong>. Nosso time entrará em
          contato se houver fit.
        </p>
        <Link to="/careers">
          <Button variant="outline" className="mt-6">
            Ver outras vagas
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/careers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Todas as vagas
        </Link>

        <header className="mt-4">
          <h1 className="text-3xl font-semibold tracking-tight">{jobAny.title}</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            {jobAny.seniority && <Badge variant="outline">{jobAny.seniority}</Badge>}
            {jobAny.employment_type && <Badge variant="outline">{jobAny.employment_type}</Badge>}
            {jobAny.remote_mode && <Badge variant="outline">{jobAny.remote_mode}</Badge>}
            {jobAny.location && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {jobAny.location}
              </span>
            )}
            {(jobAny.salary_min || jobAny.salary_max) && (
              <Badge variant="secondary">
                {jobAny.salary_currency ?? "BRL"}{" "}
                {jobAny.salary_min?.toLocaleString("pt-BR") ?? "?"}
                {jobAny.salary_max ? ` – ${jobAny.salary_max.toLocaleString("pt-BR")}` : ""}
              </Badge>
            )}
          </div>
        </header>

        {(jobAny.description || jobAny.requirements) && (
          <Card className="mt-6">
            <CardContent className="pt-5 space-y-5">
              {jobAny.description && (
                <section>
                  <h2 className="font-semibold mb-2">Sobre a vaga</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {jobAny.description}
                  </p>
                </section>
              )}
              {jobAny.requirements && (
                <section>
                  <h2 className="font-semibold mb-2">Requisitos</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {jobAny.requirements}
                  </p>
                </section>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardContent className="pt-5">
            <h2 className="font-semibold mb-4">Candidate-se</h2>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.full_name || !form.email) {
                  toast.error("Nome e e-mail são obrigatórios.");
                  return;
                }
                mutation.mutate();
              }}
            >
              <div className="space-y-1 sm:col-span-2">
                <Label>Nome completo *</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>LinkedIn</Label>
                <Input
                  placeholder="https://linkedin.com/in/seu-perfil"
                  value={form.linkedin_url}
                  onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Cidade / Estado</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Link do currículo (PDF)</Label>
                <Input
                  placeholder="https://… (Drive, Dropbox, etc.)"
                  value={form.cv_url}
                  onChange={(e) => setForm((f) => ({ ...f, cv_url: e.target.value }))}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Mensagem (opcional)</Label>
                <Textarea
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Enviando…" : "Enviar candidatura"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
