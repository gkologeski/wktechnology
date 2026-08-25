import type { ReactNode, ElementType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageInput } from "@/components/ui/image-input";
import {
  Type,
  Image as ImageIcon,
  MousePointerClick,
  Minus,
  StretchVertical,
  LayoutGrid,
  Quote,
  Megaphone,
  FormInput,
  Film,
  HelpCircle,
  Trophy,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type Block = { type: string; [k: string]: unknown };

type RenderProps = {
  block: Block;
  editable?: boolean;
  onInlineEdit?: (patch: Partial<Block>) => void;
};

type PropsProps = {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
};

type BlockDef = {
  type: string;
  label: string;
  icon: LucideIcon;
  defaults: Block;
  Render: (p: RenderProps) => ReactNode;
  Properties: (p: PropsProps) => ReactNode;
};

// Inline editable text helper — contentEditable
function Editable({
  value,
  editable,
  as: As = "span",
  className,
  onChange,
  placeholder,
}: {
  value: string;
  editable?: boolean;
  as?: ElementType;
  className?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
}) {
  if (!editable) {
    return <As className={className}>{value || placeholder}</As>;
  }
  return (
    <As
      className={`${className ?? ""} outline-none focus:ring-2 focus:ring-primary/40 rounded px-1 -mx-1`}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onBlur={(e: React.FocusEvent<HTMLElement>) => onChange?.((e.target as HTMLElement).innerText)}
    >
      {value}
    </As>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function AreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// HERO
const hero: BlockDef = {
  type: "hero",
  label: "Hero",
  icon: Sparkles,
  defaults: {
    type: "hero",
    headline: "Headline principal",
    subheadline: "Subtítulo curto e direto",
    cta: "Comece agora",
    align: "center",
  },
  Render: ({ block, editable, onInlineEdit }) => (
    <section
      className={`py-20 px-6 bg-gradient-to-b from-primary/5 to-transparent ${
        block.align === "left" ? "text-left" : "text-center"
      }`}
    >
      <div className="max-w-3xl mx-auto">
        <Editable
          as="h1"
          editable={editable}
          className="text-4xl md:text-5xl font-bold mb-4"
          value={String(block.headline ?? "")}
          placeholder="Headline"
          onChange={(v) => onInlineEdit?.({ headline: v })}
        />
        <Editable
          as="p"
          editable={editable}
          className="text-lg md:text-xl text-muted-foreground mb-8"
          value={String(block.subheadline ?? "")}
          placeholder="Subtítulo"
          onChange={(v) => onInlineEdit?.({ subheadline: v })}
        />
        {block.cta ? <Button size="lg">{String(block.cta)}</Button> : null}
      </div>
    </section>
  ),
  Properties: ({ block, onChange }) => (
    <>
      <TextField
        label="Headline"
        value={String(block.headline ?? "")}
        onChange={(v) => onChange({ headline: v })}
      />
      <AreaField
        label="Subtítulo"
        value={String(block.subheadline ?? "")}
        onChange={(v) => onChange({ subheadline: v })}
      />
      <TextField
        label="Texto do botão"
        value={String(block.cta ?? "")}
        onChange={(v) => onChange({ cta: v })}
      />
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Alinhamento</Label>
        <div className="flex gap-2">
          {["left", "center"].map((a) => (
            <Button
              key={a}
              size="sm"
              variant={block.align === a ? "default" : "outline"}
              onClick={() => onChange({ align: a })}
            >
              {a === "left" ? "Esquerda" : "Centro"}
            </Button>
          ))}
        </div>
      </div>
    </>
  ),
};

// RICH TEXT
const richtext: BlockDef = {
  type: "richtext",
  label: "Texto",
  icon: Type,
  defaults: { type: "richtext", text: "Digite seu texto aqui..." },
  Render: ({ block, editable, onInlineEdit }) => (
    <section className="py-10 px-6 max-w-3xl mx-auto">
      <Editable
        as="div"
        editable={editable}
        className="prose prose-neutral max-w-none whitespace-pre-wrap text-base leading-relaxed"
        value={String(block.text ?? "")}
        placeholder="Texto"
        onChange={(v) => onInlineEdit?.({ text: v })}
      />
    </section>
  ),
  Properties: ({ block, onChange }) => (
    <AreaField
      label="Texto"
      value={String(block.text ?? "")}
      onChange={(v) => onChange({ text: v })}
      rows={8}
    />
  ),
};

// IMAGE
const image: BlockDef = {
  type: "image",
  label: "Imagem",
  icon: ImageIcon,
  defaults: { type: "image", src: "", alt: "", caption: "" },
  Render: ({ block }) => (
    <section className="py-8 px-6 max-w-4xl mx-auto text-center">
      {block.src ? (
        <img
          src={String(block.src)}
          alt={String(block.alt ?? "")}
          className="rounded-lg mx-auto max-h-[500px] w-auto"
        />
      ) : (
        <div className="border-2 border-dashed border-border rounded-lg py-16 text-muted-foreground">
          <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Adicione a URL de uma imagem
        </div>
      )}
      {block.caption ? (
        <p className="text-sm text-muted-foreground mt-2">{String(block.caption)}</p>
      ) : null}
    </section>
  ),
  Properties: ({ block, onChange }) => (
    <>
      <ImageInput
        label="Imagem"
        value={String(block.src ?? "")}
        onChange={(v) => onChange({ src: v ?? "" })}
      />
      <TextField
        label="Texto alternativo (alt)"
        value={String(block.alt ?? "")}
        onChange={(v) => onChange({ alt: v })}
      />
      <TextField
        label="Legenda"
        value={String(block.caption ?? "")}
        onChange={(v) => onChange({ caption: v })}
      />
    </>
  ),
};

// BUTTON
const button: BlockDef = {
  type: "button",
  label: "Botão",
  icon: MousePointerClick,
  defaults: {
    type: "button",
    label: "Clique aqui",
    href: "#",
    variant: "default",
    align: "center",
  },
  Render: ({ block }) => (
    <section
      className={`py-8 px-6 ${block.align === "left" ? "text-left" : block.align === "right" ? "text-right" : "text-center"}`}
    >
      <Button
        asChild
        size="lg"
        variant={(block.variant as "default" | "outline" | "secondary") ?? "default"}
      >
        <a href={String(block.href ?? "#")}>{String(block.label ?? "Botão")}</a>
      </Button>
    </section>
  ),
  Properties: ({ block, onChange }) => (
    <>
      <TextField
        label="Rótulo"
        value={String(block.label ?? "")}
        onChange={(v) => onChange({ label: v })}
      />
      <TextField
        label="Link (href)"
        value={String(block.href ?? "")}
        onChange={(v) => onChange({ href: v })}
      />
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Estilo</Label>
        <div className="flex gap-2 flex-wrap">
          {[
            { v: "default", l: "Primário" },
            { v: "outline", l: "Contorno" },
            { v: "secondary", l: "Secundário" },
          ].map((o) => (
            <Button
              key={o.v}
              size="sm"
              variant={block.variant === o.v ? "default" : "outline"}
              onClick={() => onChange({ variant: o.v })}
            >
              {o.l}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Alinhamento</Label>
        <div className="flex gap-2">
          {["left", "center", "right"].map((a) => (
            <Button
              key={a}
              size="sm"
              variant={block.align === a ? "default" : "outline"}
              onClick={() => onChange({ align: a })}
            >
              {a === "left" ? "Esq." : a === "center" ? "Centro" : "Dir."}
            </Button>
          ))}
        </div>
      </div>
    </>
  ),
};

// DIVIDER
const divider: BlockDef = {
  type: "divider",
  label: "Divisor",
  icon: Minus,
  defaults: { type: "divider" },
  Render: () => (
    <section className="py-6 px-6 max-w-3xl mx-auto">
      <hr className="border-border" />
    </section>
  ),
  Properties: () => <p className="text-sm text-muted-foreground">Sem opções para este bloco.</p>,
};

// SPACER
const spacer: BlockDef = {
  type: "spacer",
  label: "Espaço",
  icon: StretchVertical,
  defaults: { type: "spacer", height: 48 },
  Render: ({ block }) => <div style={{ height: Number(block.height ?? 48) }} />,
  Properties: ({ block, onChange }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Altura (px)</Label>
      <Input
        type="number"
        value={Number(block.height ?? 48)}
        onChange={(e) => onChange({ height: Number(e.target.value) })}
      />
    </div>
  ),
};

// FEATURES
const features: BlockDef = {
  type: "features",
  label: "Recursos",
  icon: LayoutGrid,
  defaults: {
    type: "features",
    title: "Recursos",
    items: [
      { title: "Recurso 1", description: "Descrição do recurso 1." },
      { title: "Recurso 2", description: "Descrição do recurso 2." },
      { title: "Recurso 3", description: "Descrição do recurso 3." },
    ],
  },
  Render: ({ block }) => {
    const items = (block.items as Array<{ title: string; description: string }>) ?? [];
    return (
      <section className="py-16 px-6 max-w-5xl mx-auto">
        {block.title ? (
          <h2 className="text-3xl font-bold text-center mb-10">{String(block.title)}</h2>
        ) : null}
        <div className="grid md:grid-cols-3 gap-8">
          {items.map((it, j) => (
            <div key={j} className="text-center">
              <h3 className="font-semibold text-lg mb-2">{it.title}</h3>
              <p className="text-muted-foreground">{it.description}</p>
            </div>
          ))}
        </div>
      </section>
    );
  },
  Properties: ({ block, onChange }) => {
    const items = (block.items as Array<{ title: string; description: string }>) ?? [];
    return (
      <>
        <TextField
          label="Título da seção"
          value={String(block.title ?? "")}
          onChange={(v) => onChange({ title: v })}
        />
        <div className="space-y-2">
          <Label className="text-xs font-medium">Itens</Label>
          {items.map((it, idx) => (
            <div key={idx} className="border border-border rounded p-2 space-y-2">
              <Input
                value={it.title}
                placeholder="Título"
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...next[idx], title: e.target.value };
                  onChange({ items: next });
                }}
              />
              <Textarea
                value={it.description}
                rows={2}
                placeholder="Descrição"
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...next[idx], description: e.target.value };
                  onChange({ items: next });
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange({ items: items.filter((_, j) => j !== idx) })}
              >
                Remover
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({ items: [...items, { title: "Novo recurso", description: "" }] })
            }
          >
            + Item
          </Button>
        </div>
      </>
    );
  },
};

// TESTIMONIAL
const testimonial: BlockDef = {
  type: "testimonial",
  label: "Depoimento",
  icon: Quote,
  defaults: {
    type: "testimonial",
    quote: "Excelente produto, mudou nosso negócio!",
    author: "Cliente Satisfeito",
    role: "",
  },
  Render: ({ block }) => (
    <section className="py-16 px-6 max-w-2xl mx-auto text-center">
      <Quote className="h-8 w-8 text-primary mx-auto mb-4 opacity-60" />
      <blockquote className="text-xl italic mb-4">"{String(block.quote ?? "")}"</blockquote>
      <cite className="not-italic">
        <div className="font-semibold">{String(block.author ?? "")}</div>
        {block.role ? (
          <div className="text-sm text-muted-foreground">{String(block.role)}</div>
        ) : null}
      </cite>
    </section>
  ),
  Properties: ({ block, onChange }) => (
    <>
      <AreaField
        label="Depoimento"
        value={String(block.quote ?? "")}
        onChange={(v) => onChange({ quote: v })}
      />
      <TextField
        label="Autor"
        value={String(block.author ?? "")}
        onChange={(v) => onChange({ author: v })}
      />
      <TextField
        label="Cargo / empresa"
        value={String(block.role ?? "")}
        onChange={(v) => onChange({ role: v })}
      />
    </>
  ),
};

// CTA
const cta: BlockDef = {
  type: "cta",
  label: "Chamada (CTA)",
  icon: Megaphone,
  defaults: { type: "cta", text: "Pronto para começar?", button: "Falar com vendas", href: "#" },
  Render: ({ block }) => (
    <section className="py-16 px-6 text-center bg-primary/5">
      <p className="text-2xl md:text-3xl font-semibold mb-6">{String(block.text ?? "")}</p>
      <Button asChild size="lg">
        <a href={String(block.href ?? "#")}>{String(block.button ?? "")}</a>
      </Button>
    </section>
  ),
  Properties: ({ block, onChange }) => (
    <>
      <TextField
        label="Texto"
        value={String(block.text ?? "")}
        onChange={(v) => onChange({ text: v })}
      />
      <TextField
        label="Texto do botão"
        value={String(block.button ?? "")}
        onChange={(v) => onChange({ button: v })}
      />
      <TextField
        label="Link"
        value={String(block.href ?? "")}
        onChange={(v) => onChange({ href: v })}
      />
    </>
  ),
};

// FORM
const form: BlockDef = {
  type: "form",
  label: "Formulário",
  icon: FormInput,
  defaults: {
    type: "form",
    title: "Fale conosco",
    fields: ["name", "email"],
    submitLabel: "Enviar",
  },
  Render: ({ block }) => {
    const fields = (block.fields as string[]) ?? ["name", "email"];
    const labels: Record<string, string> = {
      name: "Nome",
      email: "Email",
      phone: "Telefone",
      company: "Empresa",
      message: "Mensagem",
    };
    return (
      <section className="py-16 px-6 max-w-md mx-auto">
        {block.title ? (
          <h3 className="text-2xl font-bold text-center mb-6">{String(block.title)}</h3>
        ) : null}
        <div className="space-y-3 pointer-events-none">
          {fields.map((f) => (
            <div key={f}>
              <Label className="text-sm">{labels[f] ?? f}</Label>
              {f === "message" ? (
                <Textarea placeholder={labels[f] ?? f} />
              ) : (
                <Input placeholder={labels[f] ?? f} />
              )}
            </div>
          ))}
          <Button className="w-full">{String(block.submitLabel ?? "Enviar")}</Button>
        </div>
      </section>
    );
  },
  Properties: ({ block, onChange }) => {
    const fields = (block.fields as string[]) ?? [];
    const all = ["name", "email", "phone", "company", "message"];
    return (
      <>
        <TextField
          label="Título"
          value={String(block.title ?? "")}
          onChange={(v) => onChange({ title: v })}
        />
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Campos</Label>
          <div className="space-y-1">
            {all.map((f) => {
              const on = fields.includes(f);
              return (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...fields, f]
                        : fields.filter((x) => x !== f);
                      onChange({ fields: next });
                    }}
                  />
                  {f}
                </label>
              );
            })}
          </div>
        </div>
        <TextField
          label="Texto do botão"
          value={String(block.submitLabel ?? "")}
          onChange={(v) => onChange({ submitLabel: v })}
        />
      </>
    );
  },
};

// VIDEO
const video: BlockDef = {
  type: "video",
  label: "Vídeo",
  icon: Film,
  defaults: { type: "video", url: "" },
  Render: ({ block }) => {
    const url = String(block.url ?? "");
    const ytMatch = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    const embed = ytMatch
      ? `https://www.youtube.com/embed/${ytMatch[1]}`
      : vimeoMatch
        ? `https://player.vimeo.com/video/${vimeoMatch[1]}`
        : null;
    return (
      <section className="py-12 px-6 max-w-4xl mx-auto">
        {embed ? (
          <div className="aspect-video rounded-lg overflow-hidden border border-border">
            <iframe src={embed} className="w-full h-full" allowFullScreen />
          </div>
        ) : (
          <div className="aspect-video border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Film className="h-10 w-10 mx-auto mb-2 opacity-50" />
              Cole uma URL do YouTube ou Vimeo
            </div>
          </div>
        )}
      </section>
    );
  },
  Properties: ({ block, onChange }) => (
    <TextField
      label="URL do vídeo (YouTube/Vimeo)"
      value={String(block.url ?? "")}
      onChange={(v) => onChange({ url: v })}
      placeholder="https://youtube.com/watch?v=..."
    />
  ),
};

// FAQ
const faq: BlockDef = {
  type: "faq",
  label: "Perguntas",
  icon: HelpCircle,
  defaults: {
    type: "faq",
    title: "Perguntas frequentes",
    items: [
      { q: "Como funciona?", a: "Explicação detalhada." },
      { q: "Quanto custa?", a: "Veja nossos planos." },
    ],
  },
  Render: ({ block }) => {
    const items = (block.items as Array<{ q: string; a: string }>) ?? [];
    return (
      <section className="py-16 px-6 max-w-3xl mx-auto">
        {block.title ? (
          <h2 className="text-3xl font-bold text-center mb-8">{String(block.title)}</h2>
        ) : null}
        <div className="space-y-3">
          {items.map((it, i) => (
            <details key={i} className="border border-border rounded-lg p-4 group">
              <summary className="font-medium cursor-pointer flex justify-between items-center">
                {it.q}
                <span className="text-muted-foreground group-open:rotate-180 transition">▾</span>
              </summary>
              <p className="mt-3 text-muted-foreground">{it.a}</p>
            </details>
          ))}
        </div>
      </section>
    );
  },
  Properties: ({ block, onChange }) => {
    const items = (block.items as Array<{ q: string; a: string }>) ?? [];
    return (
      <>
        <TextField
          label="Título"
          value={String(block.title ?? "")}
          onChange={(v) => onChange({ title: v })}
        />
        <div className="space-y-2">
          <Label className="text-xs font-medium">Perguntas</Label>
          {items.map((it, idx) => (
            <div key={idx} className="border border-border rounded p-2 space-y-2">
              <Input
                value={it.q}
                placeholder="Pergunta"
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...next[idx], q: e.target.value };
                  onChange({ items: next });
                }}
              />
              <Textarea
                value={it.a}
                rows={2}
                placeholder="Resposta"
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...next[idx], a: e.target.value };
                  onChange({ items: next });
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange({ items: items.filter((_, j) => j !== idx) })}
              >
                Remover
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange({ items: [...items, { q: "Nova pergunta", a: "" }] })}
          >
            + Pergunta
          </Button>
        </div>
      </>
    );
  },
};

// STATS
const stats: BlockDef = {
  type: "stats",
  label: "Números",
  icon: Trophy,
  defaults: {
    type: "stats",
    items: [
      { value: "10k+", label: "Clientes" },
      { value: "99%", label: "Satisfação" },
      { value: "24/7", label: "Suporte" },
    ],
  },
  Render: ({ block }) => {
    const items = (block.items as Array<{ value: string; label: string }>) ?? [];
    return (
      <section className="py-16 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-center">
          {items.map((it, i) => (
            <div key={i}>
              <div className="text-4xl md:text-5xl font-bold text-primary">{it.value}</div>
              <div className="text-muted-foreground mt-1">{it.label}</div>
            </div>
          ))}
        </div>
      </section>
    );
  },
  Properties: ({ block, onChange }) => {
    const items = (block.items as Array<{ value: string; label: string }>) ?? [];
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium">Métricas</Label>
        {items.map((it, idx) => (
          <div key={idx} className="border border-border rounded p-2 space-y-2">
            <Input
              value={it.value}
              placeholder="Valor (ex: 10k+)"
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...next[idx], value: e.target.value };
                onChange({ items: next });
              }}
            />
            <Input
              value={it.label}
              placeholder="Rótulo"
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...next[idx], label: e.target.value };
                onChange({ items: next });
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange({ items: items.filter((_, j) => j !== idx) })}
            >
              Remover
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onChange({ items: [...items, { value: "0", label: "Novo" }] })}
        >
          + Métrica
        </Button>
      </div>
    );
  },
};

export const BLOCKS: BlockDef[] = [
  hero,
  richtext,
  image,
  button,
  features,
  stats,
  testimonial,
  cta,
  form,
  video,
  faq,
  divider,
  spacer,
];

export const REGISTRY: Record<string, BlockDef> = Object.fromEntries(
  BLOCKS.map((b) => [b.type, b]),
);
