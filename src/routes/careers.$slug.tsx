// Página pública /careers/$slug — detalhe da vaga + formulário de candidatura.
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader, MetaPill, Skeletons } from "@/components/techhire/ui";
import { getPublicJob, submitPublicApplication } from "@/lib/ats/public.functions";

export const Route = createFileRoute("/careers/$slug")({
  loader: async ({ params }) => {
    const host = typeof window !== "undefined" ? window.location.host : null;
    const job = await getPublicJob({ data: { host, slug: params.slug } });
    return { job };
  },
  head: ({ loaderData, params }) => {
    const job = (
      loaderData as { job: { title?: string; description?: string | null } | null } | undefined
    )?.job;
    const title = job?.title ? `${job.title} — Vagas` : "Vaga";
    const desc = (job?.description ?? "Candidate-se à nossa vaga.").slice(0, 160);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `/careers/${params.slug}` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
    };
  },
  component: CareerJobPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold text-text-primary">Vaga não encontrada</h1>
      <p className="mt-2 text-text-secondary">Esta vaga pode ter sido encerrada ou despublicada.</p>
      <Link to="/careers" className="mt-4 inline-block text-primary hover:underline">
        ← Ver outras vagas
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold text-text-primary">Ops</h1>
      <p className="mt-2 text-text-secondary">{error.message}</p>
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
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-10">
        <Skeletons.Card />
        <Skeletons.Card />
      </div>
    );
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
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold text-text-primary">Candidatura enviada!</h1>
        <p className="mt-2 text-text-secondary">
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
    <div className="min-h-screen bg-background text-text-primary">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/careers"
          className="inline-flex items-center gap-1 text-sm text-text-secondary transition hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Todas as vagas
        </Link>

        <header className="mt-4 border-b border-border-subtle pb-6">
          <h1 className="text-3xl font-semibold tracking-tight">{jobAny.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {jobAny.seniority && <MetaPill>{jobAny.seniority}</MetaPill>}
            {jobAny.employment_type && <MetaPill>{jobAny.employment_type}</MetaPill>}
            {jobAny.remote_mode && <MetaPill>{jobAny.remote_mode}</MetaPill>}
            {jobAny.location && (
              <MetaPill>
                <MapPin className="h-3 w-3" aria-hidden />
                {jobAny.location}
              </MetaPill>
            )}
            {(jobAny.salary_min || jobAny.salary_max) && (
              <MetaPill className="bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-fg))] border-[hsl(var(--status-info-fg)/0.2)]">
                {jobAny.salary_currency ?? "BRL"}{" "}
                {jobAny.salary_min?.toLocaleString("pt-BR") ?? "?"}
                {jobAny.salary_max ? ` – ${jobAny.salary_max.toLocaleString("pt-BR")}` : ""}
              </MetaPill>
            )}
          </div>
        </header>

        {(jobAny.description || jobAny.requirements) && (
          <section className="surface-1 mt-6 space-y-6 rounded-lg border border-border-subtle p-6">
            {jobAny.description && (
              <div className="space-y-2">
                <SectionHeader title="Sobre a vaga" />
                <p className="whitespace-pre-wrap text-sm text-text-secondary">
                  {jobAny.description}
                </p>
              </div>
            )}
            {jobAny.requirements && (
              <div className="space-y-2">
                <SectionHeader title="Requisitos" />
                <p className="whitespace-pre-wrap text-sm text-text-secondary">
                  {jobAny.requirements}
                </p>
              </div>
            )}
          </section>
        )}

        <section className="surface-1 mt-6 space-y-5 rounded-lg border border-border-subtle p-6">
          <SectionHeader
            title="Candidate-se"
            description="Os campos marcados com * são obrigatórios."
          />
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.full_name || !form.email) {
                toast.error("Nome e e-mail são obrigatórios.");
                return;
              }
              mutation.mutate();
            }}
          >
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="full_name">Nome completo *</Label>
              <Input
                id="full_name"
                required
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="linkedin_url">LinkedIn</Label>
              <Input
                id="linkedin_url"
                placeholder="https://linkedin.com/in/seu-perfil"
                value={form.linkedin_url}
                onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Cidade / Estado</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cv_url">Link do currículo (PDF)</Label>
              <Input
                id="cv_url"
                placeholder="https://… (Drive, Dropbox, etc.)"
                value={form.cv_url}
                onChange={(e) => setForm((f) => ({ ...f, cv_url: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="message">Mensagem (opcional)</Label>
              <Textarea
                id="message"
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Enviando…" : "Enviar candidatura"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
