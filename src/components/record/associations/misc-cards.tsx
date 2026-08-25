import type { AssociationEntity } from "../associations-panel";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ListTodo, Mail, Paperclip } from "lucide-react";
import { formatDateTime } from "@/lib/crm";
import { AssocCard, Empty, relCol } from "./primitives";

/* ───────────── unchanged read-only cards ───────────── */

export function TasksCard({ entity, entityId }: { entity: AssociationEntity; entityId: string }) {
  const [rows, setRows] = useState<
    { id: string; subject: string | null; due_date: string | null }[]
  >([]);
  const fetchRows = useCallback(() => {
    supabase
      .from("activities")
      .select("id, subject, due_date")
      .eq("type", "task")
      .eq("completed", false)
      .eq(relCol(entity), entityId)
      .order("due_date", { ascending: true })
      .limit(10)
      .then(({ data }) => setRows((data ?? []) as never));
  }, [entity, entityId]);
  useEffect(() => {
    fetchRows();
    const handler = () => fetchRows();
    window.addEventListener("activities:changed", handler);
    return () => window.removeEventListener("activities:changed", handler);
  }, [fetchRows]);
  return (
    <AssocCard icon={<ListTodo className="w-4 h-4" />} title="Tarefas abertas" count={rows.length}>
      {rows.length === 0 ? (
        <Empty label="Nenhuma tarefa aberta." />
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li key={t.id}>
              <Link to="/tasks/$id" params={{ id: t.id }} className="block group">
                <p className="text-xs font-semibold text-foreground group-hover:text-primary break-words">
                  {t.subject || "(sem assunto)"}
                </p>
                {t.due_date && (
                  <p className="text-[10px] text-muted-foreground">
                    Vence {formatDateTime(t.due_date)}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

export function EmailsCard({ entity, entityId }: { entity: AssociationEntity; entityId: string }) {
  const [rows, setRows] = useState<
    { id: string; subject: string | null; created_at: string; hs_createdate: string | null }[]
  >([]);
  const fetchRows = useCallback(() => {
    supabase
      .from("activities")
      .select("id, subject, created_at, hs_createdate")
      .eq("type", "email")
      .eq(relCol(entity), entityId)
      .order("hs_createdate", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setRows((data ?? []) as never));
  }, [entity, entityId]);
  useEffect(() => {
    fetchRows();
    const handler = () => fetchRows();
    window.addEventListener("activities:changed", handler);
    return () => window.removeEventListener("activities:changed", handler);
  }, [fetchRows]);
  return (
    <AssocCard icon={<Mail className="w-4 h-4" />} title="Emails recentes" count={rows.length}>
      {rows.length === 0 ? (
        <Empty label="Nenhum email." />
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.id} className="text-xs">
              <p className="font-semibold text-foreground break-words">
                {e.subject || "(sem assunto)"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatDateTime(e.hs_createdate ?? e.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

export function AttachmentsCard({
  entity,
  entityId,
}: {
  entity: AssociationEntity;
  entityId: string;
}) {
  const [rows, setRows] = useState<{ name: string; path: string; type?: string }[]>([]);
  const fetchRows = useCallback(() => {
    supabase
      .from("activities")
      .select("attachments")
      .eq(relCol(entity), entityId)
      .not("attachments", "is", null)
      .limit(100)
      .then(({ data }) => {
        const flat: { name: string; path: string; type?: string }[] = [];
        for (const r of data ?? []) {
          const raw = (r as { attachments?: unknown }).attachments;
          const atts = Array.isArray(raw)
            ? (raw as { name: string; path: string; type?: string }[])
            : [];
          for (const a of atts) {
            if (a && typeof a === "object" && "path" in a && "name" in a) flat.push(a);
          }
        }
        setRows(flat.slice(0, 10));
      });
  }, [entity, entityId]);
  useEffect(() => {
    fetchRows();
    const handler = () => fetchRows();
    window.addEventListener("activities:changed", handler);
    return () => window.removeEventListener("activities:changed", handler);
  }, [fetchRows]);
  const open = async (path: string) => {
    const { data } = await supabase.storage.from("notes-attachments").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  const ext = (n: string) => n.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE";
  return (
    <AssocCard icon={<Paperclip className="w-4 h-4" />} title="Anexos" count={rows.length}>
      {rows.length === 0 ? (
        <Empty label="Nenhum anexo." />
      ) : (
        <ul className="space-y-2">
          {rows.map((a, i) => (
            <li key={i}>
              <button
                onClick={() => open(a.path)}
                className="flex items-center gap-2 text-xs text-muted-foreground group w-full text-left"
              >
                <span className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold shrink-0">
                  {ext(a.name)}
                </span>
                <span className="group-hover:text-primary truncate">{a.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}
