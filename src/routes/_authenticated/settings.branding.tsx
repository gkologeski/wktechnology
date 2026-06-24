import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandingBuilder } from "@/components/branding/branding-builder";
import { ModuleBrandingForm } from "@/components/branding/module-branding-form";
import { MODULES } from "@/lib/modules/registry";

export const Route = createFileRoute("/_authenticated/settings/branding")({
  component: BrandingPage,
});

function BrandingPage() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Branding</h1>
        <p className="text-sm text-muted-foreground">
          Personalize a marca do workspace (ERP) e o branding de cada módulo
          (TechSales CRM, TechHire ATS).
        </p>
      </div>
      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace (ERP)</TabsTrigger>
          <TabsTrigger value="crm">{MODULES.crm.productName}</TabsTrigger>
          <TabsTrigger value="ats">{MODULES.ats.productName}</TabsTrigger>
        </TabsList>
        <TabsContent value="workspace" className="mt-4">
          <BrandingBuilder />
        </TabsContent>
        <TabsContent value="crm" className="mt-4">
          <ModuleBrandingForm moduleId="crm" />
        </TabsContent>
        <TabsContent value="ats" className="mt-4">
          <ModuleBrandingForm moduleId="ats" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
