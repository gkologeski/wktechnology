import { createFileRoute } from "@tanstack/react-router";
import { getPublishedBySlug, trackLpEvent } from "@/lib/landing-pages.functions";
import { useEffect, useState } from "react";
import { REGISTRY, type Block } from "@/components/landing-pages/blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/lp/$slug")({
  loader: async ({ params }) => getPublishedBySlug({ data: { slug: params.slug } }),
  component: PublicLandingPage,
  head: ({ params, loaderData }) => {
    const p = loaderData?.page as { title?: string; description?: string | null } | null;
    const url = `https://app.wktechnology.com.br/lp/${params.slug}`;
    const title = p?.title || "Landing page — WK Technology CRM";
    const rawDesc = p?.description || "";
    const description =
      rawDesc && rawDesc.length >= 50
        ? rawDesc
        : `${title}. Conheça a solução do WK Technology CRM e descubra como organizar seus leads, contatos e negócios em um só lugar.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: title,
            description,
            url,
          }),
        },
      ],
    };
  },
});

type Theme = { primaryColor?: string; bgColor?: string; font?: string };

function PublicLandingPage() {
  const { page } = Route.useLoaderData() as {
    page: {
      id: string;
      title: string;
      blocks: Block[];
      theme?: Theme;
    } | null;
  };
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!page) return;
    trackLpEvent({ data: { landing_page_id: page.id, event_type: "view" } }).catch(() => null);
  }, [page]);

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Página não encontrada</p>
      </div>
    );
  }

  const theme = page.theme ?? {};
  const fontFamily =
    theme.font === "serif"
      ? "ui-serif, Georgia, serif"
      : theme.font === "mono"
        ? "ui-monospace, monospace"
        : undefined;

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!page) return;
    await trackLpEvent({ data: { landing_page_id: page.id, event_type: "conversion" } });
    setSubmitted(true);
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: theme.bgColor || undefined,
        fontFamily,
        // expose primary as CSS var so blocks pick it up via tailwind primary if desired
        ...(theme.primaryColor
          ? ({ ["--primary" as never]: theme.primaryColor } as React.CSSProperties)
          : {}),
      }}
    >
      {page.blocks.map((block, i) => {
        // Form is special: needs working submit + state, render custom
        if (block.type === "form") {
          const fields = ((block as { fields?: string[] }).fields ?? ["name", "email"]) as string[];
          const labels: Record<string, string> = {
            name: "Nome",
            email: "Email",
            phone: "Telefone",
            company: "Empresa",
            message: "Mensagem",
          };
          return (
            <section key={i} className="py-16 px-6 max-w-md mx-auto">
              {(block as { title?: string }).title ? (
                <h3 className="text-2xl font-bold text-center mb-6">
                  {String((block as { title?: string }).title)}
                </h3>
              ) : null}
              {submitted ? (
                <p className="text-center text-lg">Obrigado! Em breve entraremos em contato.</p>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-3">
                  {fields.map((f) => (
                    <div key={f}>
                      <Label>{labels[f] ?? f}</Label>
                      {f === "message" ? (
                        <Textarea required name={f} placeholder={labels[f] ?? f} />
                      ) : (
                        <Input
                          required
                          type={f === "email" ? "email" : "text"}
                          name={f}
                          placeholder={labels[f] ?? f}
                        />
                      )}
                    </div>
                  ))}
                  <Button type="submit" className="w-full">
                    {String((block as { submitLabel?: string }).submitLabel ?? "Enviar")}
                  </Button>
                </form>
              )}
            </section>
          );
        }
        const def = REGISTRY[block.type];
        if (!def) return null;
        const Render = def.Render;
        return <Render key={i} block={block} />;
      })}
    </div>
  );
}
