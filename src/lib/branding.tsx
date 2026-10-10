// White-label / branding por workspace ativo (+ sobrescritas por módulo).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useActiveModule } from "@/lib/modules/active-module";
import type { ModuleId } from "@/lib/modules/registry";
import { mergeThemes, themeToCss, sanitizeTheme, type BrandTheme } from "@/lib/branding/tokens";

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
  theme?: BrandTheme | null;
};

const BrandingContext = createContext<Branding | null>(null);
const CACHE_KEY = "wk:branding-cache:v2";
const MODULE_CACHE_KEY = "wk:module-branding-cache:v1";
const STYLE_ID = "wk-branding-theme";

function applyThemeCss(theme: BrandTheme | null) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  const css = theme ? themeToCss(theme) : "";
  if (!css) {
    if (el) el.textContent = "";
    return;
  }
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
}

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

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, JSON.stringify(value));
    else window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readCachedBranding(): Branding | null {
  return readJson<Branding>(CACHE_KEY);
}

type ModuleThemes = Partial<Record<ModuleId, BrandTheme>>;

// Aplica o branding em cache o quanto antes (apenas no browser), antes do React
// montar, para que um refresh não pisque a paleta padrão.
if (typeof window !== "undefined") {
  const cached = readCachedBranding();
  if (cached) {
    applyBranding(cached);
    applyThemeCss(cached.theme ?? null);
  }
}

const BRANDING_COLUMNS =
  "brand_name, logo_url, favicon_url, primary_color, accent_color, support_email, footer_text, radius, density, heading_font, body_font, theme";

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const activeModule = useActiveModule();
  const [branding, setBranding] = useState<Branding | null>(() => readCachedBranding());
  const [moduleThemes, setModuleThemes] = useState<ModuleThemes>(
    () => readJson<ModuleThemes>(MODULE_CACHE_KEY) ?? {},
  );

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let loadedWorkspace: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let seq = 0;

    const unsubscribe = () => {
      if (retry) clearTimeout(retry);
      retry = null;
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    };

    // Tempo real só das linhas de branding do workspace carregado (RLS de membro).
    const subscribe = (workspaceId: string) => {
      unsubscribe();
      if (cancelled || document.hidden) return;
      const fail = () => {
        if (cancelled || loadedWorkspace !== workspaceId) return;
        if (channel) void supabase.removeChannel(channel);
        channel = null;
        if (retry) clearTimeout(retry);
        retry = setTimeout(() => subscribe(workspaceId), realtimeRetryDelay(attempt++));
      };
      let c = supabase.channel(`branding:${user.id}:${workspaceId}`);
      for (const f of brandingRealtimeFilters(workspaceId)) {
        c = c.on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "*", schema: "public", table: f.table, filter: f.filter },
          () => bump(),
        );
      }
      channel = c
        // O SDK responde SUBSCRIBED mesmo com postgres_changes recusado; a recusa vem em "system".
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("system" as any, {}, (p: { status?: string; extension?: string }) => {
          if (p?.status === "error" && p.extension === "postgres_changes") fail();
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") attempt = 0;
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") fail();
        });
    };

    const load = async () => {
      const my = ++seq;
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
      if (!workspaceId || cancelled || my !== seq) return;

      const [{ data }, { data: modules }] = await Promise.all([
        supabase
          .from("workspace_branding")
          .select(BRANDING_COLUMNS)
          .eq("workspace_id", workspaceId)
          .maybeSingle(),
        supabase.from("module_branding").select("module_id, theme").eq("workspace_id", workspaceId),
      ]);
      if (cancelled || my !== seq) return; // resposta de um contexto anterior: descarta

      const next = (data as Branding | null) ?? null;
      setBranding(next);
      writeJson(CACHE_KEY, next);

      const map: ModuleThemes = {};
      for (const row of modules ?? []) {
        const theme = (row as { module_id: string; theme: unknown }).theme as BrandTheme | null;
        if (theme && Object.keys(theme).length) {
          map[(row as { module_id: string }).module_id as ModuleId] = theme;
        }
      }
      setModuleThemes(map);
      writeJson(MODULE_CACHE_KEY, map);

      if (loadedWorkspace !== workspaceId || !channel) {
        loadedWorkspace = workspaceId;
        attempt = 0;
        subscribe(workspaceId);
      }
    };

    // Rajadas (várias cores salvas de uma vez) viram uma recarga.
    const bump = () => {
      if (debounce) return;
      debounce = setTimeout(() => {
        debounce = null;
        void load();
      }, 300);
    };

    void load();
    const offWorkspace = onWorkspaceChanged(() => void load());
    // Ao voltar à aba: reconcilia (pode ter perdido eventos) e reabre a assinatura.
    const onVis = () => {
      if (document.hidden) unsubscribe();
      else void load().then(() => loadedWorkspace && !channel && subscribe(loadedWorkspace));
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      offWorkspace();
      document.removeEventListener("visibilitychange", onVis);
      if (debounce) clearTimeout(debounce);
      unsubscribe();
    };
  }, [user?.id]);

  const effectiveTheme = useMemo(
    () => sanitizeTheme(mergeThemes(branding?.theme ?? null, moduleThemes[activeModule] ?? null)),
    [branding?.theme, moduleThemes, activeModule],
  );

  useEffect(() => {
    applyBranding(branding);
  }, [branding]);

  useEffect(() => {
    applyThemeCss(effectiveTheme);
  }, [effectiveTheme]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
