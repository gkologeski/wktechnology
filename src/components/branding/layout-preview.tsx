import { useSharedAction } from "@/lib/access-control/use-shared-action";
import { useState, type CSSProperties } from "react";
import {
  ChevronDown,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Sun,
  Moon,
  ArrowUpDown,
} from "lucide-react";
import { defaultThemeColors } from "@/lib/branding/tokens";
import type { PreviewSettings } from "./live-preview";
import type { PreviewMode } from "./preview-targets";

/** Illustrative data only; the workspace itself uses the existing guarded components. */
export function LayoutPreview({
  settings,
  mode,
  onModeChange,
}: {
  settings: PreviewSettings;
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
}) {
  const canView = useSharedAction("system.branding", "view");
  const [view, setView] = useState("Ficha");
  const dark = mode === "dark";
  const colors = {
    ...defaultThemeColors(mode),
    ...(dark ? settings.theme?.dark : settings.theme?.light),
  };
  if (!dark) {
    colors.primary = settings.theme?.light?.primary ?? settings.primary;
    colors.accent = settings.theme?.light?.accent ?? settings.accent;
  }
  const style = {
    ...Object.fromEntries(Object.entries(colors).map(([key, value]) => [`--${key}`, value])),
    "--radius": `${settings.radius}px`,
    fontFamily: settings.bodyFont,
    color: colors.foreground,
    background: colors.card,
  } as CSSProperties;
  const logo =
    (dark ? settings.theme?.assets?.logo_dark : settings.theme?.assets?.logo_light) ||
    settings.logoUrl;
  if (!canView) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p>Prévia ilustrativa · Layout Essencial</p>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border px-3 py-2"
          onClick={() => onModeChange(dark ? "light" : "dark")}
          aria-label={dark ? "Prévia no tema claro" : "Prévia no tema escuro"}
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />} {dark ? "Claro" : "Escuro"}
        </button>
      </div>
      <div
        data-workspace-layout="attio"
        style={style}
        className="min-h-[500px] overflow-hidden rounded-xl border border-border text-xs"
      >
        <div className="flex min-h-[500px]">
          <aside className="hidden w-40 shrink-0 space-y-5 border-r border-border-subtle bg-sidebar/40 p-3 sm:block">
            <div className="flex items-center gap-2 font-semibold">
              {logo ? (
                <img
                  src={logo}
                  alt={settings.brandName || "Marca"}
                  className="h-7 w-7 object-contain"
                />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                  {settings.brandName.slice(0, 1) || "W"}
                </span>
              )}
              <span className="truncate">{settings.brandName || "Workspace"}</span>
            </div>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Search size={14} /> Buscar…
            </p>
            <nav aria-label="Telas da prévia" className="space-y-1">
              {["Dashboard", "Negócios", "Ficha", "Inbox"].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setView(name)}
                  aria-pressed={view === name}
                  className={`flex w-full rounded-md px-2 py-2 text-left ${view === name ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                >
                  {name}
                </button>
              ))}
            </nav>
            <p className="pt-5 text-muted-foreground">
              TechSales <ChevronDown size={12} className="inline" />
            </p>
          </aside>
          <div className="min-w-0 flex-1">
            <header className="flex items-center justify-between gap-2 px-4 py-3 text-muted-foreground">
              <span>TechSales / {view}</span>
              <MoreHorizontal size={16} />
            </header>
            <select
              aria-label="Tela da prévia"
              className="m-3 rounded border bg-card p-2 sm:hidden"
              value={view}
              onChange={(event) => setView(event.target.value)}
            >
              {["Dashboard", "Negócios", "Ficha", "Inbox"].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <div className="p-4">
              <h2
                style={{ fontFamily: settings.headingFont }}
                className="mb-5 text-xl font-semibold tracking-tight"
              >
                {view === "Ficha" ? "Projeto Alfa" : view}
              </h2>
              {view === "Ficha" ? (
                <>
                  <div className="mb-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rounded-md bg-accent px-3 py-1.5 text-accent-foreground"
                      onClick={() => setView("Negócios")}
                    >
                      Negociação <ChevronDown size={12} className="inline" />
                    </button>
                    <span className="py-1.5">R$ 48.000,00</span>
                    <span className="py-1.5 text-muted-foreground">Responsável comercial</span>
                  </div>
                  <div className="grid gap-7 xl:grid-cols-[140px_1fr_155px]">
                    <section>
                      <h3 className="mb-4 font-semibold">Propriedades</h3>
                      {["Empresa", "Responsável", "Fechamento"].map((label) => (
                        <p key={label} className="mb-4 text-muted-foreground">
                          {label}
                          <span className="mt-1 block text-foreground">
                            {label === "Empresa"
                              ? "Empresa exemplo"
                              : label === "Responsável"
                                ? "Equipe comercial"
                                : "A definir"}
                          </span>
                        </p>
                      ))}
                    </section>
                    <section>
                      <h3 className="mb-4 font-semibold">Atividades</h3>
                      <div className="mb-5 flex gap-3 text-primary">
                        <span>+ Nota</span>
                        <span>E-mail</span>
                        <span>Tarefa</span>
                      </div>
                      <p className="mb-5 text-muted-foreground">Hoje</p>
                      <p className="mb-2 font-medium">Proposta aceita</p>
                      <p className="text-muted-foreground">
                        O histórico continua no centro da ficha.
                      </p>
                    </section>
                    <section>
                      <h3 className="mb-4 font-semibold">Jornada de contratação</h3>
                      <p className="mb-4 text-muted-foreground">Próxima etapa: minuta</p>
                      <h3 className="mb-3 font-semibold">Associações</h3>
                      <p>Empresa exemplo</p>
                      <p className="mt-3 text-muted-foreground">1 contato associado</p>
                    </section>
                  </div>
                </>
              ) : view === "Negócios" ? (
                <>
                  <div className="mb-4 flex flex-wrap gap-3 text-muted-foreground">
                    <span className="flex gap-1">
                      <Filter size={13} /> Filtros
                    </span>
                    <span className="flex gap-1">
                      <ArrowUpDown size={13} /> Ordenar
                    </span>
                    <span className="ml-auto flex gap-1 text-primary">
                      <Plus size={13} /> Negócio
                    </span>
                  </div>
                  <table className="w-full text-left">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-3 font-medium">Nome</th>
                        <th className="font-medium">Etapa</th>
                        <th className="font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["Projeto Alfa", "Outsourcing Beta", "Consultoria Gama"].map((name) => (
                        <tr key={name} className="border-t border-border-subtle">
                          <td className="py-4">
                            <button
                              type="button"
                              className="hover:text-primary"
                              onClick={() => setView("Ficha")}
                            >
                              {name}
                            </button>
                          </td>
                          <td>Negociação</td>
                          <td>R$ 48.000</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : view === "Dashboard" ? (
                <>
                  <div className="grid grid-cols-2 gap-7">
                    <div>
                      <p className="text-muted-foreground">Receita prevista</p>
                      <p className="mt-2 text-2xl">R$ 148 mil</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Negócios ativos</p>
                      <p className="mt-2 text-2xl">24</p>
                    </div>
                  </div>
                  <h3 className="mt-10 mb-5 font-medium">Pipeline comercial</h3>
                  <div className="flex h-36 items-end gap-5" aria-label="Gráfico ilustrativo">
                    {[35, 65, 50, 85, 70].map((height, index) => (
                      <div
                        key={index}
                        className="flex-1 rounded-t bg-primary/70"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="grid gap-6 md:grid-cols-[150px_1fr]">
                  <section>
                    <p className="mb-4 font-medium">Conversas</p>
                    <p className="rounded-md bg-accent p-3 text-accent-foreground">
                      Contato exemplo
                      <br />
                      <span className="text-muted-foreground">WhatsApp · há 5 min</span>
                    </p>
                  </section>
                  <section>
                    <p className="mb-7">Contato exemplo</p>
                    <p className="mb-4 w-fit rounded-lg bg-muted p-3">
                      Olá, gostaria de conhecer os serviços.
                    </p>
                    <p className="ml-auto w-fit rounded-lg bg-accent p-3 text-accent-foreground">
                      Olá! Como posso ajudar?
                    </p>
                    <p className="mt-14 rounded-lg border border-input p-3 text-muted-foreground">
                      Escreva uma mensagem…
                    </p>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
