import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getLandingPage, saveLandingPage } from "@/lib/landing-pages.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/landing-pages/$id")({
  component: LandingPageEditor,
});

type Block = { type: string; [k: string]: unknown };

function LandingPageEditor() {
  const { id } = Route.useParams();
  const fetchPage = useServerFn(getLandingPage);
  const save = useServerFn(saveLandingPage);
  const nav = useNavigate();
  const { data, refetch } = useQuery({ queryKey: ["lp", id], queryFn: () => fetchPage({ data: { id } }) });
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [blocks, setBlocks] = useState<Block[]>([]);

  useEffect(() => {
    if (data?.page) {
      const p = data.page as { title: string; slug: string; description: string | null; status: string; blocks: Block[] };
      setTitle(p.title); setSlug(p.slug); setDescription(p.description ?? "");
      setStatus(p.status as typeof status); setBlocks(p.blocks ?? []);
    }
  }, [data]);

  async function handleSave() {
    await save({ data: { id, title, slug, description, status, blocks, theme: {}, seo: {} } });
    toast.success("Salvo");
    refetch();
  }

  function addBlock(type: string) {
    const def: Record<string, Block> = {
      hero: { type: "hero", headline: "Título", subheadline: "Subtítulo", cta: "Comece" },
      features: { type: "features", items: [{ title: "Recurso", description: "Descrição" }] },
      form: { type: "form", fields: ["name", "email"], submitLabel: "Enviar" },
      testimonial: { type: "testimonial", quote: "Excelente!", author: "Cliente" },
      cta: { type: "cta", text: "Pronto?", button: "Começar" },
    };
    setBlocks([...blocks, def[type]]);
  }

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <PageHeader
        title="Editor de landing page"
        description="Configure blocos e publique"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => nav({ to: "/landing-pages" })}>Voltar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        }
      />
      <Card className="p-4 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
        </div>
        <div><Label>Descrição (SEO)</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="published">Publicada</SelectItem>
              <SelectItem value="archived">Arquivada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Blocos</h3>
          <div className="flex gap-2">
            {["hero", "features", "form", "testimonial", "cta"].map(t => (
              <Button key={t} size="sm" variant="outline" onClick={() => addBlock(t)}>+ {t}</Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {blocks.map((b, i) => (
            <div key={i} className="border rounded p-3 flex items-center justify-between">
              <div>
                <Badge>{b.type}</Badge>
                <span className="ml-2 text-sm text-muted-foreground">{JSON.stringify(b).slice(0, 80)}…</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}>Remover</Button>
            </div>
          ))}
          {blocks.length === 0 && <p className="text-muted-foreground text-sm">Adicione blocos para começar.</p>}
        </div>
      </Card>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{children}</span>;
}
