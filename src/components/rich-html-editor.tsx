import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import createDOMPurify from "dompurify";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Code,
  Eraser,
  AtSign,
  Slash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listSnippets as listSnippetsFn,
  incrementSnippetUsage as incrementSnippetUsageFn,
  type SnippetRow,
} from "@/lib/snippets.functions";

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "img",
    "font",
    "h1",
    "h2",
    "h3",
    "h4",
    "span",
    "div",
  ],
  ALLOWED_ATTR: [
    "href",
    "target",
    "rel",
    "class",
    "style",
    "data-user-id",
    "data-mention",
    "contenteditable",
    "src",
    "alt",
    "title",
    "width",
    "height",
    "align",
    "valign",
    "colspan",
    "rowspan",
    "cellpadding",
    "cellspacing",
    "border",
    "bgcolor",
    "color",
    "face",
    "size",
  ],
};

const ALLOWED_TAG_SET = new Set(SANITIZE_CONFIG.ALLOWED_TAGS);
const ALLOWED_ATTR_SET = new Set(SANITIZE_CONFIG.ALLOWED_ATTR);

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
  return /^(https?:|mailto:|tel:|\/|#)/i.test(trimmed);
}

function sanitizeStyle(value: string): string | null {
  if (/expression\s*\(|javascript\s*:|url\s*\(/i.test(value)) return null;
  return value;
}

function sanitizeHtmlWithoutDom(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*\/?\s*([a-zA-Z0-9-]+)([^>]*)>/g, (full, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAG_SET.has(tag)) return "";
      if (/^<\s*\//.test(full)) return `</${tag}>`;
      if (tag === "br") return "<br>";

      const attrs: string[] = [];
      const attrRe = /([^\s"'=<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
      let match: RegExpExecArray | null;
      while ((match = attrRe.exec(rawAttrs)) !== null) {
        const name = match[1].toLowerCase();
        const value = match[2] ?? match[3] ?? match[4] ?? "";
        if (!ALLOWED_ATTR_SET.has(name)) continue;
        if ((name === "href" || name === "src") && !isSafeUrl(value)) continue;
        if (name === "style" && sanitizeStyle(value) === null) continue;
        attrs.push(`${name}="${escapeAttr(value)}"`);
      }
      return `<${tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`;
    });
}

export function sanitizeHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof document === "undefined") {
    return sanitizeHtmlWithoutDom(html);
  }
  const purify = createDOMPurify(window);
  return purify.sanitize(html, SANITIZE_CONFIG);
}

export function htmlToPlain(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined")
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const div = document.createElement("div");
  div.innerHTML = sanitizeHtml(html);
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

export function extractMentionIds(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  const re = /data-user-id="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return [...ids];
}

export function HtmlContent({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  return (
    <div
      className={`prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 [&_.mention]:inline-block [&_.mention]:rounded [&_.mention]:bg-primary/10 [&_.mention]:text-primary [&_.mention]:px-1 [&_.mention]:font-medium ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html ?? "") }}
    />
  );
}

export type MentionCandidate = { id: string; name: string };

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  mentions?: MentionCandidate[];
  onMentionAdd?: (m: MentionCandidate) => void;
};

export function RichHtmlEditor({
  value,
  onChange,
  placeholder,
  minHeight = 96,
  mentions,
  onMentionAdd,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Snippets ("/atalho") detection
  const listSnippetsCall = useServerFn(listSnippetsFn);
  const incSnippet = useServerFn(incrementSnippetUsageFn);
  const snippetsQ = useQuery({
    queryKey: ["snippets", "picker"],
    queryFn: () => listSnippetsCall({ data: { visibility: "all" } }),
    staleTime: 30_000,
  });
  const [snipQuery, setSnipQuery] = useState<string | null>(null);
  const [snipPos, setSnipPos] = useState<{ top: number; left: number } | null>(null);
  const [snipActiveIdx, setSnipActiveIdx] = useState(0);

  const snippetResults = useMemo(() => {
    if (snipQuery === null) return [] as SnippetRow[];
    const items = snippetsQ.data?.items ?? [];
    const needle = snipQuery.toLowerCase();
    const filteredSnips = needle
      ? items.filter(
          (s) => s.shortcut.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle),
        )
      : items;
    return filteredSnips.slice(0, 8);
  }, [snipQuery, snippetsQ.data]);

  // Keep DOM in sync when value changes externally (e.g. cleared after submit)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = el.innerHTML;
    const next = sanitizeHtml(value ?? "");
    if (current !== next && document.activeElement !== el) el.innerHTML = next;
    else if (current !== next && !current) el.innerHTML = next;
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

  const closeMentions = () => {
    setMentionQuery(null);
    setMentionPos(null);
    setActiveIdx(0);
  };

  const detectMention = useCallback(() => {
    if (!mentions || mentions.length === 0) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) {
      closeMentions();
      return;
    }
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.startContainer)) {
      closeMentions();
      return;
    }
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      closeMentions();
      return;
    }
    const textBefore = (node.textContent ?? "").slice(0, range.startOffset);
    const match = /@([^\s@<>]*)$/.exec(textBefore);
    if (!match) {
      closeMentions();
      return;
    }
    setMentionQuery(match[1]);
    setActiveIdx(0);
    // Position popover
    const rect = range.getBoundingClientRect();
    const editorRect = ref.current.getBoundingClientRect();
    setMentionPos({ top: rect.bottom - editorRect.top + 4, left: rect.left - editorRect.left });
  }, [mentions]);

  const insertMention = (m: MentionCandidate) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent ?? "";
    const before = text.slice(0, range.startOffset);
    const after = text.slice(range.startOffset);
    const match = /@([^\s@<>]*)$/.exec(before);
    if (!match) return;
    const start = before.length - match[0].length;
    // Split text node: keep before-@ in original
    (node as Text).textContent = before.slice(0, start) + after;
    // Re-set selection to insertion point in same node
    const newRange = document.createRange();
    newRange.setStart(node, start);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    // Build mention span
    const span = document.createElement("span");
    span.className = "mention";
    span.setAttribute("data-user-id", m.id);
    span.setAttribute("data-mention", "true");
    span.setAttribute("contenteditable", "false");
    span.textContent = `@${m.name}`;
    const space = document.createTextNode("\u00A0");
    newRange.insertNode(space);
    newRange.insertNode(span);
    // Move caret after space
    const afterRange = document.createRange();
    afterRange.setStartAfter(space);
    afterRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(afterRange);
    onChange(sanitizeHtml(ref.current.innerHTML));
    onMentionAdd?.(m);
    closeMentions();
  };

  const closeSnippets = useCallback(() => {
    setSnipQuery(null);
    setSnipPos(null);
    setSnipActiveIdx(0);
  }, []);

  const detectSnippet = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) {
      closeSnippets();
      return;
    }
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.startContainer)) {
      closeSnippets();
      return;
    }
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      closeSnippets();
      return;
    }
    const textBefore = (node.textContent ?? "").slice(0, range.startOffset);
    const match = /(^|\s)\/([a-zA-Z0-9_\-/]*)$/.exec(textBefore);
    if (!match) {
      closeSnippets();
      return;
    }
    setSnipQuery(match[2]);
    setSnipActiveIdx(0);
    const rect = range.getBoundingClientRect();
    const editorRect = ref.current.getBoundingClientRect();
    setSnipPos({ top: rect.bottom - editorRect.top + 4, left: rect.left - editorRect.left });
  }, [closeSnippets]);

  const insertSnippet = (s: SnippetRow) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent ?? "";
    const before = text.slice(0, range.startOffset);
    const after = text.slice(range.startOffset);
    const match = /(^|\s)\/([a-zA-Z0-9_\-/]*)$/.exec(before);
    if (!match) return;
    // Preserve the leading whitespace/BOL group; remove only "/xxx"
    const removeLen = match[0].length - match[1].length;
    const start = before.length - removeLen;
    (node as Text).textContent = before.slice(0, start) + after;
    const newRange = document.createRange();
    newRange.setStart(node, start);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    // Insert snippet body as sanitized HTML at caret
    const html = sanitizeHtml(s.body_html || (s.body_text ? escapeHtml(s.body_text) : ""));
    document.execCommand("insertHTML", false, html);
    onChange(sanitizeHtml(ref.current.innerHTML));
    void incSnippet({ data: { id: s.id } }).catch(() => {
      /* silencioso */
    });
    closeSnippets();
  };

  const filtered =
    mentionQuery !== null && mentions
      ? mentions
          .filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 6)
      : [];

  return (
    <div className="rounded-md border bg-background relative">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
        <ToolBtn onClick={() => exec("bold")} title="Negrito">
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("italic")} title="Itálico">
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("underline")} title="Sublinhado">
          <Underline className="h-3.5 w-3.5" />
        </ToolBtn>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolBtn onClick={() => exec("insertUnorderedList")} title="Lista">
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("insertOrderedList")} title="Lista numerada">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolBtn>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolBtn onClick={addLink} title="Link">
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("formatBlock", "<pre>")} title="Código">
          <Code className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("removeFormat")} title="Limpar formatação">
          <Eraser className="h-3.5 w-3.5" />
        </ToolBtn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(e) => {
          onChange(sanitizeHtml((e.target as HTMLDivElement).innerHTML));
          detectMention();
          detectSnippet();
        }}
        onKeyDown={(e) => {
          if (snipQuery !== null && snippetResults.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSnipActiveIdx((i) => (i + 1) % snippetResults.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSnipActiveIdx((i) => (i - 1 + snippetResults.length) % snippetResults.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              insertSnippet(snippetResults[snipActiveIdx]);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              closeSnippets();
              return;
            }
          }
          if (mentionQuery !== null && filtered.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => (i + 1) % filtered.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              insertMention(filtered[activeIdx]);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              closeMentions();
              return;
            }
          }
        }}
        onKeyUp={() => {
          detectMention();
          detectSnippet();
        }}
        onMouseUp={() => {
          detectMention();
          detectSnippet();
        }}
        onBlur={() => {
          setTimeout(closeMentions, 150);
          setTimeout(closeSnippets, 150);
        }}
        onPaste={(e) => {
          setTimeout(() => {
            if (ref.current) onChange(sanitizeHtml(ref.current.innerHTML));
          }, 0);
          void e;
        }}
        className="prose prose-sm max-w-none dark:prose-invert px-3 py-2 focus:outline-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 [&_.mention]:inline-block [&_.mention]:rounded [&_.mention]:bg-primary/10 [&_.mention]:text-primary [&_.mention]:px-1 [&_.mention]:font-medium empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
        style={{ minHeight }}
      />
      {mentionQuery !== null && filtered.length > 0 && mentionPos && (
        <div
          className="absolute z-50 w-64 rounded-md border bg-popover p-1 shadow-md"
          style={{ top: mentionPos.top + 36, left: mentionPos.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => insertMention(m)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${i === activeIdx ? "bg-muted" : ""}`}
            >
              <AtSign className="h-3 w-3 text-muted-foreground" />
              {m.name}
            </button>
          ))}
        </div>
      )}
      {snipQuery !== null && snippetResults.length > 0 && snipPos && (
        <div
          className="absolute z-50 w-80 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
          style={{ top: snipPos.top + 36, left: snipPos.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {snippetResults.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => insertSnippet(s)}
              onMouseEnter={() => setSnipActiveIdx(i)}
              className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm ${i === snipActiveIdx ? "bg-muted" : "hover:bg-muted/60"}`}
            >
              <Slash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">/{s.shortcut}</span>
                  <span className="truncate text-xs text-muted-foreground">{s.name}</span>
                  {s.visibility === "shared" && (
                    <span className="ml-auto rounded bg-primary/10 px-1 text-[10px] text-primary">
                      compartilhado
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {s.body_text || (s.body_html ? s.body_html.replace(/<[^>]+>/g, " ") : "")}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
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
