import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandingBuilder } from "@/components/branding/branding-builder";
import { ModuleBrandingForm } from "@/components/branding/module-branding-form";
import { InviteEmailBrandingForm } from "@/components/branding/invite-email-branding-form";
import { MODULES, type ModuleId } from "@/lib/modules/registry";

export const Route = createFileRoute("/_authenticated/settings/branding")({
  component: BrandingPage,
});

// Services é consolidado dentro de Contratos — não tem branding próprio.
const BRANDABLE_MODULES: ModuleId[] = ["crm", "ats", "contracts", "projects", "finance", "people"];

function BrandingPage() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Branding</h1>
        <p className="text-sm text-muted-foreground">
          Personalize a marca do workspace (ERP), o branding de cada módulo e o e-mail de convite.
        </p>
      </div>
      <Tabs defaultValue="workspace">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="workspace">Workspace (ERP)</TabsTrigger>
          <TabsTrigger value="invite">Convite</TabsTrigger>
          {BRANDABLE_MODULES.map((id) => (
            <TabsTrigger key={id} value={id}>
              {MODULES[id].productName}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="workspace" className="mt-4">
          <BrandingBuilder />
        </TabsContent>
        <TabsContent value="invite" className="mt-4">
          <InviteEmailBrandingForm />
        </TabsContent>
        {BRANDABLE_MODULES.map((id) => (
          <TabsContent key={id} value={id} className="mt-4">
            <ModuleBrandingForm moduleId={id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
