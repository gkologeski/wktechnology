// White-label / branding por workspace ativo.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Branding = {
  brand_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  support_email: string | null;
  footer_text: string | null;
};

const BrandingContext = createContext<Branding | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    if (!user?.id) { setBranding(null); return; }
    let cancelled = false;

    const load = async () => {
      // Resolve active workspace
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_workspace_id")
        .eq("id", user.id)
        .maybeSingle();

      let workspaceId = profile?.active_workspace_id as string | null | undefined;
      if (!workspaceId) {
        const { data: member } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        workspaceId = member?.workspace_id;
      }
      if (!workspaceId || cancelled) return;

      const { data } = await supabase
        .from("workspace_branding")
        .select("brand_name, logo_url, favicon_url, primary_color, accent_color, support_email, footer_text")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!cancelled && data) setBranding(data as Branding);
      else if (!cancelled) setBranding(null);
    };

    load();

    // Re-load when active workspace changes (workspace switcher updates profiles)
    const channel = supabase
      .channel(`branding:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!branding) {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--accent");
      return;
    }
    if (branding.primary_color) root.style.setProperty("--primary", branding.primary_color);
    if (branding.accent_color) root.style.setProperty("--accent", branding.accent_color);
    if (branding.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.favicon_url;
    }
    if (branding.brand_name) document.title = branding.brand_name;
  }, [branding]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
