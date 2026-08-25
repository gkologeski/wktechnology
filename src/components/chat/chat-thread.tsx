// Thread de mensagens de uma conversa (lista + composer).
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, Send, Loader2, X, FileIcon, Download, FolderOpen } from "lucide-react";
import { FileCenterPickerDialog } from "@/components/files/file-center-picker";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SnippetTextarea } from "@/components/snippets/snippet-textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listMessages, sendMessage } from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

export type Conv = {
  id: string;
  kind: "dm" | "group";
  title: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender: string | null;
  unread_count: number;
  member_user_ids: string[];
};

type Attachment = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
};

type Msg = {
  id: string;
  sender_user_id: string;
  body: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  attachments: Attachment[];
};

const MAX_FILES = 10;
const MAX_SIZE = 20 * 1024 * 1024;

export function ChatThread({
  conversation,
  labelFor,
}: {
  conversation: Conv;
  labelFor: (c: Conv) => string;
}) {
  const { user } = useAuth();
  const { nameFor, initialsFor } = useWorkspaceMembers();
  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendMessage);
  const qc = useQueryClient();

  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["chat", "messages", conversation.id],
    queryFn: () =>
      listFn({ data: { conversation_id: conversation.id, limit: 50 } }) as Promise<Msg[]>,
    staleTime: 30_000,
  });

  useEffect(() => {
    queueMicrotask(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, [messages.length, conversation.id]);

  const sendMut = useMutation({
    mutationFn: async () => {
      const trimmed = body.trim();
      if (!trimmed && files.length === 0) return;
      setSending(true);
      const messageId = crypto.randomUUID();
      // Get active workspace id from existing conversation: not directly available here.
      // Path: chat/{conv}/{msg}/{filename} — top folder is workspace, but we don't need
      // it client-side; the bucket policy only checks segment 2 (conversation_id).
      // We use a stable workspace placeholder "ws" since RLS only validates seg-2.
      // (If you ever scope per-workspace listing, replace with real id.)
      const attachments: {
        storage_path: string;
        file_name: string;
        mime_type?: string;
        size_bytes?: number;
      }[] = [];
      for (const f of files) {
        const safeName = f.name.replace(/[^\w.-]+/g, "_");
        const path = `ws/${conversation.id}/${messageId}/${safeName}`;
        const { error } = await supabase.storage.from("chat-attachments").upload(path, f, {
          upsert: false,
          contentType: f.type || undefined,
        });
        if (error) throw new Error(`Falha ao enviar ${f.name}: ${error.message}`);
        attachments.push({
          storage_path: path,
          file_name: f.name,
          mime_type: f.type || undefined,
          size_bytes: f.size,
        });
      }
      await sendFn({
        data: {
          message_id: messageId,
          conversation_id: conversation.id,
          body: trimmed,
          attachments,
        },
      });
    },
    onSuccess: () => {
      setBody("");
      setFiles([]);
      qc.invalidateQueries({ queryKey: ["chat", "messages", conversation.id] });
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setSending(false),
  });

  const addFiles = (picked: File[]) => {
    const total = [...files, ...picked];
    if (total.length > MAX_FILES) {
      toast.error(`Máximo ${MAX_FILES} arquivos por mensagem.`);
      return;
    }
    for (const f of picked) {
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} excede 20 MB.`);
        return;
      }
    }
    setFiles(total);
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    addFiles(picked);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending) sendMut.mutate();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScrollArea ref={scrollRef as never} className="flex-1 px-4 py-3">
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Sem mensagens ainda. Envie a primeira.
            </div>
          )}
          {messages.map((m, i) => {
            const mine = m.sender_user_id === user?.id;
            const prev = messages[i - 1];
            const showHeader = !prev || prev.sender_user_id !== m.sender_user_id;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {showHeader && conversation.kind === "group" && !mine ? (
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px]">
                      {initialsFor(m.sender_user_id)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-7 shrink-0" />
                )}
                <div
                  className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}
                >
                  {showHeader && conversation.kind === "group" && !mine && (
                    <span className="text-xs text-muted-foreground px-1">
                      {nameFor(m.sender_user_id)}
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm break-words ${
                      mine ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {m.body && <div className="whitespace-pre-wrap">{m.body}</div>}
                    {m.attachments.length > 0 && (
                      <div className="space-y-1 mt-1">
                        {m.attachments.map((a) => (
                          <AttachmentItem key={a.id} att={a} />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1">
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-t p-3 space-y-2">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 text-xs border rounded px-2 py-1 bg-muted"
              >
                <FileIcon className="h-3 w-3" />
                <span className="max-w-[140px] truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="cursor-pointer" aria-label="Anexar arquivo">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={onPickFiles}
              aria-label="Anexar arquivo"
            />
            <span
              className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted"
              aria-hidden="true"
            >
              <Paperclip className="h-4 w-4" />
            </span>
          </label>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
            onClick={() => setPickerOpen(true)}
            aria-label="Escolher do Centro de Arquivos"
            title="Centro de Arquivos"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
          <FileCenterPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onPicked={(picked) => addFiles(picked)}
          />
          <SnippetTextarea
            value={body}
            onChange={setBody}
            onKeyDown={onKey}
            placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
            className="min-h-[40px] max-h-32 resize-none"
            rows={1}
          />
          <Button
            type="button"
            size="icon"
            disabled={sending || (!body.trim() && files.length === 0)}
            onClick={() => sendMut.mutate()}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AttachmentItem({ att }: { att: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = att.mime_type?.startsWith("image/");

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.storage
        .from("chat-attachments")
        .createSignedUrl(att.storage_path, 3600);
      if (!cancel) setUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancel = true;
    };
  }, [att.storage_path]);

  if (isImage && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img src={url} alt="" className="max-h-48 rounded border" />
      </a>
    );
  }
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 text-xs underline opacity-90 hover:opacity-100"
    >
      <Download className="h-3 w-3" />
      <span className="truncate max-w-[200px]">{att.file_name}</span>
    </a>
  );
}
