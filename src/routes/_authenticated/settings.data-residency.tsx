import { useSharedAction } from "@/lib/access-control/use-shared-action";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe2 } from "lucide-react";
import { toast } from "sonner";
import { getWorkspaceSecurity, updateDataRegion } from "@/lib/security.functions";

export const Route = createFileRoute("/_authenticated/settings/data-residency")({
  component: DataResidencyPage,
});

const REGIONS = [
  {
    code: "BR",
    label: "Brasil (São Paulo)",
    flag: "🇧🇷",
    note: "Preferência de localização no Brasil.",
  },
  {
    code: "US",
    label: "Estados Unidos",
    flag: "🇺🇸",
    note: "Preferência de localização nos Estados Unidos.",
  },
  {
    code: "EU",
    label: "União Europeia",
    flag: "🇪🇺",
    note: "Preferência de localização na União Europeia.",
  },
] as const;

function DataResidencyPage() {
  const canManage = useSharedAction("system.settings", "manage");
  const get = useServerFn(getWorkspaceSecurity);
  const update = useServerFn(updateDataRegion);
  const [region, setRegion] = useState<"BR" | "US" | "EU">("BR");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void get({}).then((r) => {
      setRegion(r.dataRegion);
      setLoaded(true);
    });
  }, []);

  const choose = async (code: "BR" | "US" | "EU") => {
    if (!canManage) return;
    await update({ data: { region: code } });
    setRegion(code);
    toast.success(`Região atualizada para ${code}`);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Globe2 className="h-5 w-5" /> Data Residency
        </h1>
        <p className="text-sm text-muted-foreground">
          Define em que região os dados deste workspace ficam armazenados. A movimentação física
          entre regiões depende do plano e da migração coordenada pelo suporte.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {REGIONS.map((r) => (
          <Card
            key={r.code}
            className={region === r.code ? "border-primary ring-1 ring-primary" : ""}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {r.flag} {r.label}
              </CardTitle>
              <CardDescription className="text-xs">{r.note}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
              {region === r.code ? (
                <Badge>Selecionada</Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => choose(r.code)}
                  disabled={!loaded || !canManage}
                >
                  Selecionar
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        ⚠️ Alterar a região aqui marca a preferência. Migração física do dataset ativo precisa ser
        solicitada ao suporte.
      </p>
    </div>
  );
}
