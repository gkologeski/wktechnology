import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).single()
      .then(({ data }) => setFullName(data?.full_name ?? ""));
  }, [user]);

  const save = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    setLoading(false);
    if (error) toast.error(error.message); else toast.success("Salvo");
  };

  return (
    <div>
      <PageHeader title="Configurações" description="Atualize seu perfil." />
      <Card className="max-w-lg">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div className="space-y-2"><Label>Nome completo</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <Button onClick={save} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
