import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  RichHtmlEditor,
  HtmlContent,
  extractMentionIds,
  type MentionCandidate,
} from "@/components/rich-html-editor";
import { MessageCircle, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/crm";
import { toast } from "sonner";
import { notifyActivityCommentEvent } from "@/lib/notifications.functions";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

type CommentRow = {
  id: string;
  activity_id: string;
  workspace_id: string;
  author_id: string;
  body: string;
  mentions: string[];
  created_at: string;
  updated_at: string;
};

type Props = {
  activityId: string;
  workspaceId: string | null | undefined;
  team: MentionCandidate[];
  disabled?: boolean;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function ActivityComments({ activityId, workspaceId, team, disabled }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  // Virtual/synthetic ids are not real activities → no comments possible.
  const isVirtual = !activityId || activityId.startsWith("cal_") || activityId.length !== 36;

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of team) m.set(t.id, t.name);
    return m;
  }, [team]);

  useEffect(() => {
    if (isVirtual || !workspaceId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("activity_comments")
        .select("id, activity_id, workspace_id, author_id, body, mentions, created_at, updated_at")
        .eq("activity_id", activityId)
        .order("created_at", { ascending: true });
      if (!mounted) return;
      if (!error && data) setItems(data as CommentRow[]);
      setLoading(false);
    })();
    // Realtime updates
    const channel = supabase
      .channel(`activity_comments:${activityId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity_comments",
          filter: `activity_id=eq.${activityId}`,
        },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as CommentRow;
              if (prev.some((r) => r.id === row.id)) return prev;
              return [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as CommentRow;
              return prev.map((r) => (r.id === row.id ? row : r));
            }
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as { id: string };
              return prev.filter((r) => r.id !== oldRow.id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [activityId, workspaceId, isVirtual]);

  if (isVirtual) return null;

  const post = async () => {
    if (!user || !workspaceId) return;
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    try {
      const mentions = extractMentionIds(body);
      const payload = {
        activity_id: activityId,
        workspace_id: workspaceId,
        author_id: user.id,
        body,
        mentions,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("activity_comments")
        .insert(payload)
        .select("id, activity_id, workspace_id, author_id, body, mentions, created_at, updated_at")
        .single();
      if (error) throw error;
      setItems((prev) =>
        prev.some((r) => r.id === (data as CommentRow).id) ? prev : [...prev, data as CommentRow],
      );
      setDraft("");
      setComposing(false);
      setExpanded(true);
      // Fire-and-forget notifications (mentions + activity owner/creator)
      notifyActivityCommentEvent({
        data: {
          commentId: (data as CommentRow).id,
          activityId,
          mentionIds: mentions,
          previousMentionIds: [],
          bodySnippet: body,
        },
      }).catch(() => {
        /* silent */
      });
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Falha ao comentar");
    } finally {
      setPosting(false);
    }
  };

  const saveEdit = async (c: CommentRow) => {
    const body = editDraft.trim();
    if (!body) return;
    try {
      const newMentions = extractMentionIds(body);
      const prevMentions = c.mentions ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("activity_comments")
        .update({ body, mentions: newMentions })
        .eq("id", c.id);
      if (error) throw error;
      setItems((prev) =>
        prev.map((r) => (r.id === c.id ? { ...r, body, mentions: newMentions } : r)),
      );
      setEditingId(null);
      setEditDraft("");
      // Notify only the newly-added mentions on edit
      const added = newMentions.filter((id) => !prevMentions.includes(id));
      if (added.length > 0) {
        notifyActivityCommentEvent({
          data: {
            commentId: c.id,
            activityId,
            mentionIds: newMentions,
            previousMentionIds: prevMentions,
            bodySnippet: body,
          },
        }).catch(() => {
          /* silent */
        });
      }
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Falha ao salvar");
    }
  };

  const removeOne = async (c: CommentRow) => {
    if (!(await confirmDialog("Excluir este comentário?"))) return;
    try {
      await deleteByIdGuarded(supabase, "activity_comments", c.id);
      setItems((prev) => prev.filter((r) => r.id !== c.id));
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Falha ao excluir");
    }
  };

  const count = items.length;
  const showList = expanded || composing || count > 0;

  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-expanded={expanded}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {count === 0 ? "Comentários" : `${count} comentário${count === 1 ? "" : "s"}`}
        </button>
        {!composing && !disabled && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setComposing(true);
              setExpanded(true);
            }}
          >
            Comentar
          </Button>
        )}
      </div>

      {showList && (
        <div className="mt-3 space-y-3">
          {loading && items.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
            </div>
          ) : (
            items.map((c) => {
              const authorName = nameById.get(c.author_id) ?? "Usuário";
              const isMine = c.author_id === user?.id;
              const isEditing = editingId === c.id;
              return (
                <div key={c.id} className="flex gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px]">{initials(authorName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs font-medium text-foreground">{authorName}</span>
                      <span
                        className="text-[11px] text-muted-foreground"
                        title={new Date(c.created_at).toLocaleString("pt-BR")}
                      >
                        {formatDateTime(c.created_at)}
                        {c.updated_at !== c.created_at && " · editado"}
                      </span>
                    </div>
                    {isEditing ? (
                      <div className="mt-1">
                        <RichHtmlEditor
                          value={editDraft}
                          onChange={setEditDraft}
                          mentions={team}
                          minHeight={64}
                          placeholder="Editar comentário…"
                        />
                        <div className="mt-2 flex gap-1">
                          <Button size="sm" className="h-7 text-xs" onClick={() => saveEdit(c)}>
                            <Check className="h-3 w-3 mr-1" /> Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => {
                              setEditingId(null);
                              setEditDraft("");
                            }}
                          >
                            <X className="h-3 w-3 mr-1" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <HtmlContent html={c.body} className="text-sm text-foreground/90 mt-0.5" />
                        {isMine && (
                          <div className="mt-1 flex gap-1 opacity-70 hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] text-muted-foreground"
                              onClick={() => {
                                setEditingId(c.id);
                                setEditDraft(c.body);
                              }}
                            >
                              <Pencil className="h-3 w-3 mr-1" /> Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] text-muted-foreground hover:text-destructive"
                              onClick={() => removeOne(c)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Excluir
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {composing && !disabled && (
        <div className="mt-3">
          <RichHtmlEditor
            value={draft}
            onChange={setDraft}
            mentions={team}
            minHeight={72}
            placeholder="Escreva um comentário… use @ para mencionar"
          />
          <div className="mt-2 flex gap-1">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={post}
              disabled={posting || !draft.trim()}
            >
              {posting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              Comentar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setComposing(false);
                setDraft("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
