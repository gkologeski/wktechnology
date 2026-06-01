// Meus chamados — usuário vê os próprios bug reports enviados pelo botão flutuante.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BUG_CATEGORIES, BUG_KINDS } from "@/lib/bug-report-taxonomy";
import { Bug, Video } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-bug-reports")({
  component: MyBugReportsPage,
});

const STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  triaged: "Triado",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  wont_fix: "Não será corrigido",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "destructive",
  triaged: "secondary",
  in_progress: "default",
  resolved: "outline",
  wont_fix: "outline",
};

function catLabel(value: string) {
  return BUG_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
function subLabel(cat: string, value: string) {
  return BUG_CATEGORIES.find((c) => c.value === cat)?.subtypes.find((s) => s.value === value)?.label ?? value;
}
function kindLabel(value: string) {
  return BUG_KINDS.find((k) => k.value === value)?.label ?? value;
}

function MyBugReportsPage() {
  const { user } = useAuth();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);

  const list = useQuery({
    queryKey: ["my-bug-reports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bug_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const openVideo = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("bug-reports")
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      setVideoUrl(data.signedUrl);
      setVideoOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o vídeo");
    }
  };

  const rows = list.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Meus chamados"
        description="Chamados que você abriu pelo botão flutuante de feedback."
      />

      {list.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Você ainda não abriu nenhum chamado. Use o botão flutuante no canto inferior direito.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const created = new Date(r.created_at as string);
            return (
              <Card key={r.id as string}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_VARIANT[r.status as string] ?? "secondary"}>
                      {STATUS_LABEL[r.status as string] ?? r.status}
                    </Badge>
                    <Badge variant="outline">{kindLabel(r.kind as string)}</Badge>
                    <Badge variant="outline">
                      {catLabel(r.category as string)} · {subLabel(r.category as string, r.subtype as string)}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {format(created, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap">{r.description as string}</p>
                  {r.recording_path && (
                    <Button variant="secondary" size="sm" onClick={() => openVideo(r.recording_path as string)}>
                      <Video className="h-4 w-4 mr-2" />
                      Ver minha gravação
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={videoOpen} onOpenChange={(o) => { setVideoOpen(o); if (!o) setVideoUrl(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gravação do chamado</DialogTitle>
            <DialogDescription>O link expira em 1 hora.</DialogDescription>
          </DialogHeader>
          {videoUrl && (
            <video src={videoUrl} controls autoPlay className="w-full rounded border bg-black" />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVideoOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
