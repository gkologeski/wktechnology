import { useEffect, useRef } from "react";
import DOMPurify from "isomorphic-dompurify";
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Code, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
    "blockquote", "code", "pre", "h1", "h2", "h3", "h4", "span", "div",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
};

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html ?? "", SANITIZE_CONFIG);
}

export function htmlToPlain(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const div = document.createElement("div");
  div.innerHTML = sanitizeHtml(html);
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

export function HtmlContent({ html, className }: { html: string | null | undefined; className?: string }) {
  return (
    <div
      className={`prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html ?? "") }}
    />
  );
}

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

export function RichHtmlEditor({ value, onChange, placeholder, minHeight = 96 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Keep DOM in sync when value changes externally (e.g. cleared after submit)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = el.innerHTML;
    const next = sanitizeHtml(value ?? "");
    if (current !== next) el.innerHTML = next;
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(sanitizeHtml(ref.current.innerHTML));
  };

  const addLink = () => {
    const url = window.prompt("URL do link:");
    if (!url) return;
    exec("createLink", url);
  };

  return (
    <div className="rounded-md border bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
        <ToolBtn onClick={() => exec("bold")} title="Negrito"><Bold className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("italic")} title="Itálico"><Italic className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("underline")} title="Sublinhado"><Underline className="h-3.5 w-3.5" /></ToolBtn>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolBtn onClick={() => exec("insertUnorderedList")} title="Lista"><List className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("insertOrderedList")} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></ToolBtn>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolBtn onClick={addLink} title="Link"><LinkIcon className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("formatBlock", "<pre>")} title="Código"><Code className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("removeFormat")} title="Limpar formatação"><Eraser className="h-3.5 w-3.5" /></ToolBtn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(e) => onChange(sanitizeHtml((e.target as HTMLDivElement).innerHTML))}
        onPaste={(e) => {
          // Allow paste — sanitize after
          setTimeout(() => {
            if (ref.current) onChange(sanitizeHtml(ref.current.innerHTML));
          }, 0);
          void e;
        }}
        className="prose prose-sm max-w-none dark:prose-invert px-3 py-2 focus:outline-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
        style={{ minHeight }}
      />
    </div>
  );
}

function ToolBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
