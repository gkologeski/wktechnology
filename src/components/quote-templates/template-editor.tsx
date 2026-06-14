import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  QUOTE_TEMPLATE_TOKENS,
  renderQuoteTemplate,
  sampleQuoteContext,
} from "@/lib/quote-template-renderer";

export type TemplateEditorValue = {
  name: string;
  description: string;
  html: string;
};

type Props = {
  value: TemplateEditorValue;
  onChange: (v: TemplateEditorValue) => void;
  readOnlyName?: boolean;
};

const ACTIONS_PLACEHOLDER = `<div style="margin:24px 0;padding:14px 18px;border-radius:10px;background:#e0e7ff;color:#3730a3;text-align:center;font-weight:600;font-family:sans-serif;font-size:14px;">[ Botões Aceitar / Recusar / Pagar — visíveis na página enviada ao cliente ]</div>`;

export function QuoteTemplateEditor({ value, onChange, readOnlyName }: Props) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");

  // Debounced preview build.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const rendered = renderQuoteTemplate(value.html || "", sampleQuoteContext());
        const withActions = rendered.replace(/\{\{#actions\/\}\}/g, ACTIONS_PLACEHOLDER);
        const safe = DOMPurify.sanitize(withActions, {
          WHOLE_DOCUMENT: true,
          ADD_TAGS: ["style"],
        });
        setPreviewHtml(safe);
      } catch (e) {
        setPreviewHtml(
          `<pre style="color:#b91c1c;padding:16px;font-family:monospace">${String(e)}</pre>`,
        );
      }
    }, 200);
    return () => clearTimeout(t);
  }, [value.html]);

  const insertAtCursor = (snippet: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? value.html.length;
    const end = ta.selectionEnd ?? value.html.length;
    const next = value.html.slice(0, start) + snippet + value.html.slice(end);
    onChange({ ...value, html: next });
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const tokens = useMemo(() => QUOTE_TEMPLATE_TOKENS, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome do modelo</Label>
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            disabled={readOnlyName}
            placeholder="Ex.: Modelo padrão da equipe"
          />
          {readOnlyName && (
            <p className="text-[11px] text-muted-foreground">
              Este é um modelo do sistema. Use "Duplicar" para alterar o nome.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Input
            value={value.description}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
            placeholder="Quando usar este modelo"
          />
        </div>
      </div>

      <Tabs defaultValue="split" className="w-full">
        <TabsList>
          <TabsTrigger value="split">Editor + Pré-visualização</TabsTrigger>
          <TabsTrigger value="code">Somente HTML</TabsTrigger>
          <TabsTrigger value="preview">Somente preview</TabsTrigger>
        </TabsList>

        <TabsContent value="split" className="mt-3">
          <div className="grid gap-4 lg:grid-cols-2">
            <EditorSide
              value={value}
              onChange={onChange}
              taRef={taRef}
              insertAtCursor={insertAtCursor}
              tokens={tokens}
            />
            <PreviewIframe html={previewHtml} />
          </div>
        </TabsContent>
        <TabsContent value="code" className="mt-3">
          <EditorSide
            value={value}
            onChange={onChange}
            taRef={taRef}
            insertAtCursor={insertAtCursor}
            tokens={tokens}
            fullWidth
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-3">
          <PreviewIframe html={previewHtml} tall />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EditorSide({
  value,
  onChange,
  taRef,
  insertAtCursor,
  tokens,
  fullWidth,
}: {
  value: TemplateEditorValue;
  onChange: (v: TemplateEditorValue) => void;
  taRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  insertAtCursor: (s: string) => void;
  tokens: typeof QUOTE_TEMPLATE_TOKENS;
  fullWidth?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((group) => (
          <details key={group.group} className="rounded border bg-card">
            <summary className="cursor-pointer px-2 py-1 text-[11px] font-medium text-muted-foreground select-none">
              {group.group}
            </summary>
            <div className="flex flex-wrap gap-1 p-2 max-w-[420px]">
              {group.items.map((it) => (
                <button
                  key={it.token}
                  type="button"
                  onClick={() => insertAtCursor(it.token)}
                  title={it.token}
                  className="rounded bg-muted px-1.5 py-0.5 text-[11px] hover:bg-muted/70"
                >
                  {it.label}
                </button>
              ))}
            </div>
          </details>
        ))}
      </div>
      <Textarea
        ref={taRef}
        value={value.html}
        onChange={(e) => onChange({ ...value, html: e.target.value })}
        spellCheck={false}
        className={`font-mono text-xs ${fullWidth ? "min-h-[640px]" : "min-h-[520px]"}`}
        placeholder="<html>...</html>"
      />
      <p className="text-[11px] text-muted-foreground">
        Dica: use <code className="rounded bg-muted px-1">{`{{quote.total}}`}</code>,{" "}
        <code className="rounded bg-muted px-1">{`{{#each items}}…{{/each}}`}</code> e{" "}
        <code className="rounded bg-muted px-1">{`{{#actions/}}`}</code> para inserir os botões
        finais.
      </p>
    </div>
  );
}

function PreviewIframe({ html, tall }: { html: string; tall?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">
          Pré-visualização
        </Label>
        <Badge variant="outline" className="text-[10px]">
          Dados de exemplo
        </Badge>
      </div>
      <iframe
        title="Pré-visualização do modelo"
        sandbox=""
        srcDoc={html}
        className={`w-full rounded border bg-white ${tall ? "min-h-[720px]" : "min-h-[520px]"}`}
      />
    </div>
  );
}
