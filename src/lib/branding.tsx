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
  radius: string | null;
  density: string | null;
  heading_font: string | null;
  body_font: string | null;
};

const BrandingContext = createContext<Branding | null>(null);
const CACHE_KEY = "wk:branding-cache:v1";

function applyBranding(branding: Branding | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!branding) {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--accent");
    root.style.removeProperty("--radius");
    root.style.removeProperty("--font-heading");
    root.style.removeProperty("--font-body");
    root.removeAttribute("data-density");
    return;
  }
  if (branding.primary_color) root.style.setProperty("--primary", branding.primary_color);
  if (branding.accent_color) root.style.setProperty("--accent", branding.accent_color);
  if (branding.radius) root.style.setProperty("--radius", branding.radius);
  if (branding.heading_font) root.style.setProperty("--font-heading", branding.heading_font);
  if (branding.body_font) root.style.setProperty("--font-body", branding.body_font);
  if (branding.density) root.setAttribute("data-density", branding.density);
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
}

function readCachedBranding(): Branding | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Branding;
  } catch {
    return null;
  }
}

function writeCachedBranding(b: Branding | null) {
  if (typeof window === "undefined") return;
  try {
    if (b) window.localStorage.setItem(CACHE_KEY, JSON.stringify(b));
    else window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// Apply cached branding ASAP on module load (browser only), before React mounts,
// so a hard refresh doesn't flash the default blue palette.
if (typeof window !== "undefined") {
  const cached = readCachedBranding();
  if (cached) applyBranding(cached);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<Branding | null>(() => readCachedBranding());

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
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
        .select(
          "brand_name, logo_url, favicon_url, primary_color, accent_color, support_email, footer_text, radius, density, heading_font, body_font",
        )
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (cancelled) return;
      const next = (data as Branding | null) ?? null;
      setBranding(next);
      writeCachedBranding(next);
    };

    load();

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
    applyBranding(branding);
  }, [branding]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
