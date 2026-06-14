import { createFileRoute } from "@tanstack/react-router";
import { getPublishedBySlug, trackLpEvent } from "@/lib/landing-pages.functions";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/lp/$slug")({
  loader: async ({ params }) => getPublishedBySlug({ data: { slug: params.slug } }),
  component: PublicLandingPage,
  head: ({ params, loaderData }) => {
    const p = loaderData?.page as { title?: string; description?: string | null } | null;
    const url = `https://crm.wktechnology.com.br/lp/${params.slug}`;
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

type Block = Record<string, unknown> & { type: string };

function PublicLandingPage() {
  const { page } = Route.useLoaderData() as {
    page: { id: string; title: string; blocks: Block[] } | null;
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!page) return;
    await trackLpEvent({ data: { landing_page_id: page.id, event_type: "conversion" } });
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-background">
      {page.blocks.map((b, i) => {
        if (b.type === "hero") {
          return (
            <section
              key={i}
              className="py-24 px-6 text-center bg-gradient-to-b from-primary/5 to-transparent"
            >
              <h1 className="text-5xl font-bold mb-4">{String(b.headline ?? "")}</h1>
              <p className="text-xl text-muted-foreground mb-8">{String(b.subheadline ?? "")}</p>
              {b.cta ? <Button size="lg">{String(b.cta)}</Button> : null}
            </section>
          );
        }
        if (b.type === "features") {
          const items = (b.items as Array<{ title: string; description: string }>) ?? [];
          return (
            <section key={i} className="py-16 px-6 max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
              {items.map((it, j) => (
                <div key={j}>
                  <h3 className="font-semibold mb-2">{it.title}</h3>
                  <p className="text-muted-foreground">{it.description}</p>
                </div>
              ))}
            </section>
          );
        }
        if (b.type === "form") {
          return (
            <section key={i} className="py-16 px-6 max-w-md mx-auto">
              {submitted ? (
                <p className="text-center text-lg">Obrigado! Em breve entraremos em contato.</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    required
                    name="name"
                    placeholder="Nome"
                    className="w-full border rounded px-3 py-2"
                  />
                  <input
                    required
                    type="email"
                    name="email"
                    placeholder="Email"
                    className="w-full border rounded px-3 py-2"
                  />
                  <Button type="submit" className="w-full">
                    {String(b.submitLabel ?? "Enviar")}
                  </Button>
                </form>
              )}
            </section>
          );
        }
        if (b.type === "testimonial") {
          return (
            <section key={i} className="py-16 px-6 max-w-2xl mx-auto text-center">
              <blockquote className="text-xl italic mb-3">"{String(b.quote ?? "")}"</blockquote>
              <cite className="text-muted-foreground">— {String(b.author ?? "")}</cite>
            </section>
          );
        }
        if (b.type === "cta") {
          return (
            <section key={i} className="py-16 px-6 text-center">
              <p className="text-2xl mb-4">{String(b.text ?? "")}</p>
              <Button size="lg">{String(b.button ?? "")}</Button>
            </section>
          );
        }
        return null;
      })}
    </div>
  );
}
