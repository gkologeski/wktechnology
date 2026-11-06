import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";
import { headingId } from "@/lib/help/help-toc";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

/**
 * Prepara o corpo para leitura: remove marcadores de captura (<!-- screenshot -->),
 * o título H1 inicial (a página já mostra o título) e separa as linhas
 * "**Rótulo:**" do template em parágrafos próprios.
 */
export function prepareHelpBody(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*# [^\n]*\n/, "")
    .replace(/\n(\*\*[^*\n]+:\*\*)/g, "\n\n$1");
}

/** Renderiza o corpo Markdown de um artigo da Ajuda (sem HTML bruto). */
export function HelpMarkdown({ body }: { body: string }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
          h1: ({ children }) => (
            <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2
              id={headingId(textOf(children))}
              className="scroll-mt-20 pt-4 text-lg font-semibold"
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              id={headingId(textOf(children))}
              className="scroll-mt-20 pt-2 text-base font-semibold"
            >
              {children}
            </h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
        }}
      >
        {prepareHelpBody(body)}
      </ReactMarkdown>
    </div>
  );
}
