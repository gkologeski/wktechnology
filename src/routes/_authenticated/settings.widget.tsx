import { getPublicAppUrl } from "@/lib/app-url";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings/widget")({
  component: WidgetSettings,
});

function WidgetSettings() {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(getPublicAppUrl());
  }, []);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("active_workspace_id")
        .eq("id", user.id)
        .maybeSingle();
      const active = (data as { active_workspace_id?: string } | null)?.active_workspace_id;
      if (active) {
        setWorkspaceId(active);
        return;
      }
      const { data: m } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (m?.workspace_id) setWorkspaceId(m.workspace_id);
    })();
  }, [user?.id]);

  const snippet =
    workspaceId && origin
      ? `<script src="${origin}/api/public/widget/script" data-workspace="${workspaceId}" defer></script>`
      : "Carregando…";
  const widgetUrl = workspaceId && origin ? `${origin}/widget/${workspaceId}` : "";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Widget de chat ao vivo"
        description="Cole este script no seu site para receber conversas dos visitantes."
      />
      <Card>
        <CardHeader>
          <CardTitle>Snippet de instalação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{snippet}</pre>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(snippet);
                toast.success("Copiado!");
              }}
              disabled={!workspaceId}
            >
              <Copy className="h-4 w-4 mr-1" /> Copiar snippet
            </Button>
            {widgetUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={widgetUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> Pré-visualizar
                </a>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            As conversas chegam em{" "}
            <a href="/inbox/chat" className="underline">
              Inbox › Chat ao vivo
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
