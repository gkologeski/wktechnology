import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listKbPublic } from "@/lib/kb.functions";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, BookOpen } from "lucide-react";

export const Route = createFileRoute("/kb/")({
  component: KbHome,
  head: () => ({
    meta: [
      { title: "Central de Ajuda — WK Technology CRM" },
      {
        name: "description",
        content:
          "Encontre artigos, tutoriais e respostas para suas dúvidas sobre o WK Technology CRM e como aproveitar todos os recursos da plataforma.",
      },
      { property: "og:title", content: "Central de Ajuda — WK Technology CRM" },
      {
        property: "og:description",
        content:
          "Encontre artigos, tutoriais e respostas para suas dúvidas sobre o WK Technology CRM e como aproveitar todos os recursos da plataforma.",
      },
      { property: "og:url", content: "https://app.wktechnology.com.br/kb" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://app.wktechnology.com.br/kb" }],
  }),
});

function KbHome() {
  const fn = useServerFn(listKbPublic);
  const { data } = useQuery({ queryKey: ["kb-public"], queryFn: () => fn() });
  const [q, setQ] = useState("");
  const articles = data?.articles ?? [];
  const cats = data?.categories ?? [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return articles;
    return articles.filter(
      (a) => a.title.toLowerCase().includes(s) || (a.excerpt ?? "").toLowerCase().includes(s),
    );
  }, [articles, q]);
  const byCategory = useMemo(() => {
    const map = new Map<string | null, typeof articles>();
    for (const a of filtered) {
      const key = a.category_id ?? null;
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">Central de Ajuda</h1>
          </div>
          <div className="relative max-w-xl">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar artigo…"
              className="pl-9 h-11"
            />
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-sm">Nenhum artigo encontrado.</p>
        )}
        {[...byCategory.entries()].map(([catId, list]) => {
          const cat = cats.find((c) => c.id === catId);
          return (
            <Card key={catId ?? "none"}>
              <CardHeader>
                <CardTitle className="text-base">{cat?.name ?? "Geral"}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {list.map((a) => (
                    <li key={a.id}>
                      <Link
                        to="/kb/$slug"
                        params={{ slug: a.slug }}
                        className="block py-3 hover:bg-muted/40 rounded px-2 -mx-2"
                      >
                        <div className="font-medium">{a.title}</div>
                        {a.excerpt && (
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {a.excerpt}
                          </div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
