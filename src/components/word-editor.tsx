import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";

const TextStyleWithSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null as string | null,
        parseHTML: (el: HTMLElement) => el.style.fontSize || null,
        renderHTML: (attrs: { fontSize?: string | null }) =>
          attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
      },
    };
  },
});
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { FontFamily } from "@tiptap/extension-font-family";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import createDOMPurify from "dompurify";
import { useEffect, useImperativeHandle, forwardRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Subscript as SubIcon,
  Superscript as SupIcon,
  List,
  ListOrdered,
  ListChecks,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Minus,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Pilcrow,
  Undo2,
  Redo2,
  Eraser,
  IndentDecrease,
  IndentIncrease,
  Rows,
  Columns,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageInput } from "@/components/ui/image-input";

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "hr",
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
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "span",
    "div",
    "mark",
    "sub",
    "sup",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "colgroup",
    "col",
    "img",
  ],
  ALLOWED_ATTR: [
    "href",
    "target",
    "rel",
    "class",
    "style",
    "src",
    "alt",
    "title",
    "width",
    "height",
    "colspan",
    "rowspan",
    "align",
    "data-type",
    "data-checked",
    "colwidth",
  ],
};

const ALLOWED_TAG_SET = new Set(SANITIZE_CONFIG.ALLOWED_TAGS);
const ALLOWED_ATTR_SET = new Set(SANITIZE_CONFIG.ALLOWED_ATTR);

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
  return /^(https?:|mailto:|tel:|data:image\/(?:png|gif|jpe?g|webp);base64,|\/|#)/i.test(trimmed);
}

function sanitizeStyle(value: string): string | null {
  if (/expression\s*\(|javascript\s*:|url\s*\(/i.test(value)) return null;
  return value;
}

function sanitizeRichHtmlWithoutDom(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*\/?\s*([a-zA-Z0-9-]+)([^>]*)>/g, (full, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAG_SET.has(tag)) return "";
      if (/^<\s*\//.test(full)) return `</${tag}>`;
      if (tag === "br" || tag === "hr") return `<${tag}>`;

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

export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof document === "undefined") {
    return sanitizeRichHtmlWithoutDom(html);
  }
  const purify = createDOMPurify(window);
  return purify.sanitize(html, SANITIZE_CONFIG);
}

export type WordEditorHandle = {
  insertHtml: (html: string) => void;
  focus: () => void;
};

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  editable?: boolean;
};

const FONT_FAMILIES = [
  { label: "Padrão", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", serif' },
  { label: "Courier New", value: '"Courier New", monospace' },
  { label: "Verdana", value: "Verdana, sans-serif" },
];

const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "32px", "48px"];

export const WordEditor = forwardRef<WordEditorHandle, Props>(function WordEditor(
  { value, onChange, placeholder, minHeight = 360, editable = true },
  ref,
) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ link: false, underline: false }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        TextStyleWithSize,
        Color,
        Highlight.configure({ multicolor: true }),
        FontFamily,
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Image,
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({ placeholder: placeholder ?? "Escreva aqui…" }),
        Subscript,
        Superscript,
      ],
      content: sanitizeRichHtml(value ?? ""),
      editable,
      editorProps: {
        attributes: {
          class:
            "prose prose-sm max-w-none dark:prose-invert focus:outline-none px-4 py-3 [&_table]:border [&_table]:border-border [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_td]:border [&_td]:border-border [&_td]:p-2 [&_img]:rounded [&_img]:max-w-full [&_hr]:my-4 [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:gap-2",
          style: `min-height: ${minHeight}px;`,
        },
      },
      onUpdate: ({ editor }) => {
        onChange(sanitizeRichHtml(editor.getHTML()));
      },
      immediatelyRender: false,
    },
    [editable],
  );

  // Sync external value (e.g., after save reset)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = sanitizeRichHtml(value ?? "");
    if (current !== next && !editor.isFocused) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  useImperativeHandle(
    ref,
    () => ({
      insertHtml: (html: string) => {
        if (!editor) return;
        editor.chain().focus().insertContent(sanitizeRichHtml(html)).run();
      },
      focus: () => editor?.commands.focus(),
    }),
    [editor],
  );

  if (!mounted || !editor) {
    return (
      <div
        className="rounded-md border bg-background"
        style={{ minHeight: minHeight + 48 }}
        aria-busy="true"
      />
    );
  }

  return (
    <div className="rounded-md border bg-background">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
});

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link:", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const [imgOpen, setImgOpen] = useState(false);
  const addImage = () => setImgOpen(true);

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const blockValue = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : editor.isActive("heading", { level: 4 })
          ? "h4"
          : "p";

  const setBlock = (v: string) => {
    if (v === "p") editor.chain().focus().setParagraph().run();
    else {
      const level = Number(v.replace("h", "")) as 1 | 2 | 3 | 4;
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
      <Btn onClick={() => editor.chain().focus().undo().run()} title="Desfazer (Ctrl+Z)">
        <Undo2 className="h-3.5 w-3.5" />
      </Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} title="Refazer (Ctrl+Y)">
        <Redo2 className="h-3.5 w-3.5" />
      </Btn>
      <Sep />

      <Select value={blockValue} onValueChange={setBlock}>
        <SelectTrigger className="h-7 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p">
            <span className="flex items-center gap-2 text-xs">
              <Pilcrow className="h-3 w-3" /> Parágrafo
            </span>
          </SelectItem>
          <SelectItem value="h1">
            <span className="flex items-center gap-2 text-xs">
              <Heading1 className="h-3 w-3" /> Título 1
            </span>
          </SelectItem>
          <SelectItem value="h2">
            <span className="flex items-center gap-2 text-xs">
              <Heading2 className="h-3 w-3" /> Título 2
            </span>
          </SelectItem>
          <SelectItem value="h3">
            <span className="flex items-center gap-2 text-xs">
              <Heading3 className="h-3 w-3" /> Título 3
            </span>
          </SelectItem>
          <SelectItem value="h4">
            <span className="flex items-center gap-2 text-xs">
              <Heading4 className="h-3 w-3" /> Título 4
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={(editor.getAttributes("textStyle").fontFamily as string) || "__default__"}
        onValueChange={(v) => {
          if (!v || v === "__default__") editor.chain().focus().unsetFontFamily().run();
          else editor.chain().focus().setFontFamily(v).run();
        }}
      >
        <SelectTrigger className="h-7 w-[130px] text-xs">
          <SelectValue placeholder="Fonte" />
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILIES.map((f) => (
            <SelectItem key={f.label} value={f.value || "__default__"} onSelect={() => {}}>
              <span style={{ fontFamily: f.value || undefined }} className="text-xs">
                {f.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={(editor.getAttributes("textStyle").fontSize as string) || ""}
        onValueChange={(v) => {
          // Use inline style via TextStyle mark by setting attribute through a custom mark would be ideal; emulate via setMark
          editor.chain().focus().setMark("textStyle", { fontSize: v }).run();
        }}
      >
        <SelectTrigger className="h-7 w-[80px] text-xs">
          <SelectValue placeholder="Tam." />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Sep />

      <Btn
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Sublinhado (Ctrl+U)"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Tachado"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("subscript")}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        title="Subscrito"
      >
        <SubIcon className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("superscript")}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        title="Sobrescrito"
      >
        <SupIcon className="h-3.5 w-3.5" />
      </Btn>

      <label
        className="ml-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-muted"
        title="Cor do texto"
      >
        <span
          className="h-3.5 w-3.5 rounded-sm border"
          style={{
            background: (editor.getAttributes("textStyle").color as string) || "currentColor",
          }}
        />
        <input
          type="color"
          className="sr-only"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>
      <label
        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-muted"
        title="Cor de destaque"
      >
        <span
          className="h-3.5 w-3.5 rounded-sm border"
          style={{ background: (editor.getAttributes("highlight").color as string) || "#fef08a" }}
        />
        <input
          type="color"
          className="sr-only"
          onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
        />
      </label>

      <Sep />

      <Btn
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        title="Alinhar à esquerda"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        title="Centralizar"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        title="Alinhar à direita"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        title="Justificar"
      >
        <AlignJustify className="h-3.5 w-3.5" />
      </Btn>

      <Sep />

      <Btn
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Lista"
      >
        <List className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Lista numerada"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title="Lista de tarefas"
      >
        <ListChecks className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().liftListItem("listItem").run()}
        title="Diminuir recuo"
      >
        <IndentDecrease className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
        title="Aumentar recuo"
      >
        <IndentIncrease className="h-3.5 w-3.5" />
      </Btn>

      <Sep />

      <Btn
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Citação"
      >
        <Quote className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Código"
      >
        <Code className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Linha horizontal"
      >
        <Minus className="h-3.5 w-3.5" />
      </Btn>

      <Sep />

      <Btn active={editor.isActive("link")} onClick={setLink} title="Link">
        <LinkIcon className="h-3.5 w-3.5" />
      </Btn>
      <Btn onClick={addImage} title="Inserir imagem">
        <ImageIcon className="h-3.5 w-3.5" />
      </Btn>
      <Dialog open={imgOpen} onOpenChange={setImgOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Inserir imagem</DialogTitle>
          </DialogHeader>
          <ImageInput
            value={null}
            onChange={(url) => {
              if (url) editor.chain().focus().setImage({ src: url }).run();
              setImgOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <Btn onClick={insertTable} title="Inserir tabela">
        <TableIcon className="h-3.5 w-3.5" />
      </Btn>
      {editor.isActive("table") && (
        <>
          <Btn onClick={() => editor.chain().focus().addRowAfter().run()} title="Adicionar linha">
            <Rows className="h-3.5 w-3.5" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Adicionar coluna"
          >
            <Columns className="h-3.5 w-3.5" />
          </Btn>
          <Btn onClick={() => editor.chain().focus().deleteTable().run()} title="Excluir tabela">
            <Trash2 className="h-3.5 w-3.5" />
          </Btn>
        </>
      )}

      <Sep />

      <Btn
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        title="Limpar formatação"
      >
        <Eraser className="h-3.5 w-3.5" />
      </Btn>
    </div>
  );
}

function Btn({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
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

function Sep() {
  return <span className="mx-1 h-4 w-px bg-border" />;
}
