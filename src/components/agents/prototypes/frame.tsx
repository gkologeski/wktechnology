import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, ShieldCheck, GitBranch, Play, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranding } from "@/lib/branding";
import { BRAND_ARCHETYPES } from "@/lib/branding/archetypes";
import { themeToCss, BRAND_TOKENS } from "@/lib/branding/tokens";
import { useDemo } from "./state";
import { AREAS } from "./model";
import "./prototypes.css";

export function PrototypeFrame({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  const branding = useBranding();
  const [archetype, setArchetype] = useState("workspace");
  const [dark, setDark] = useState<boolean | null>(null);
  const scope = `agent-demo-${number}`;
  const selected = BRAND_ARCHETYPES.find((a) => a.id === archetype);
  const logo = dark
    ? (branding?.theme?.assets?.logo_dark ?? branding?.logo_url)
    : (branding?.theme?.assets?.logo_light ?? branding?.logo_url);
  const mode = dark === true ? "dark" : "light";
  const palette = selected?.theme[mode] ?? branding?.theme?.[mode];
  const previewCss =
    dark !== null
      ? `#${scope}{${BRAND_TOKENS.map((token) => {
          const value = palette?.[token.key] ?? token[mode];
          return [token.key, ...(token.aliases ?? [])].map((key) => `--${key}:${value};`).join("");
        }).join("")}}`
      : "";
  return (
    <div
      id={scope}
      className={`agent-prototype -m-4 md:-m-6 ${dark === true ? "dark" : ""}`}
      data-testid="agent-prototype"
    >
      {selected && (
        <style>
          {themeToCss(selected.theme, `#${scope}`) +
            `#${scope}{--radius:${selected.style.radius};}`}
        </style>
      )}
      {dark !== null && <style>{previewCss}</style>}
      <div className="grid gap-2 border-b border-border-subtle bg-product-toolbar px-4 py-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {logo && (
            <img
              src={logo}
              alt={branding?.brand_name ?? "Marca do workspace"}
              className="h-5 max-w-24 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <span className="truncate text-xs font-medium">{title}</span>
          <span className="ap-caption truncate">Protótipo • dados de demonstração</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/agents/prototype">3 modelos</Link>
          </Button>
          <Select value={archetype} onValueChange={setArchetype}>
            <SelectTrigger aria-label="Arquétipo da prévia" className="h-7 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="workspace">White Label atual</SelectItem>
              {BRAND_ARCHETYPES.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Alternar tema da prévia"
            onClick={() =>
              setDark((v) =>
                v === null ? !document.documentElement.classList.contains("dark") : !v,
              )
            }
          >
            {dark ? "Claro" : "Escuro"}
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

export function Topbar({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="ap-top">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold">{title}</h1>
        {subtitle && <p className="ap-caption mt-1">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </header>
  );
}

export function Navigation() {
  const { go, view } = useDemo();
  return (
    <nav className="ap-tabs" aria-label="Telas do protótipo">
      {[
        ["list", "Agentes"],
        ["wizard", "Wizard"],
        ["studio", "Estúdio"],
        ["record", "Cliente"],
      ].map(([v, label]) => (
        <Button
          key={v}
          variant="ghost"
          size="sm"
          className={`my-2 ${view === v ? "bg-accent text-primary" : ""}`}
          onClick={() => go(v)}
        >
          {label}
        </Button>
      ))}
    </nav>
  );
}

export function StudioTabs() {
  const { area, setArea } = useDemo();
  return (
    <nav className="ap-tabs" aria-label="Áreas do estúdio">
      {AREAS.map((a, i) => {
        const Icon = [GitBranch, Play, Clock, FileText, ShieldCheck][i];
        return (
          <Button
            key={a}
            variant="ghost"
            className={`h-12 rounded-none border-b-2 px-2 text-xs ${area === a ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => setArea(a)}
          >
            {Icon && <Icon />}
            {a}
          </Button>
        );
      })}
    </nav>
  );
}
