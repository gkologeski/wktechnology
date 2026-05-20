// White-label / branding por workspace.
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
    (async () => {
      const { data } = await supabase
        .from("workspace_branding")
        .select("brand_name, logo_url, favicon_url, primary_color, accent_color, support_email, footer_text")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data) setBranding(data as Branding);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!branding) return;
    if (typeof document === "undefined") return;
    const root = document.documentElement;
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
