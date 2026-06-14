// i18n leve: dicionário + hook useT() + provider em localStorage.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "pt" | "en" | "es";

const dict: Record<Locale, Record<string, string>> = {
  pt: {
    "common.save": "Salvar",
    "common.cancel": "Cancelar",
    "common.delete": "Excluir",
    "common.edit": "Editar",
    "common.create": "Criar",
    "common.loading": "Carregando…",
    "common.search": "Buscar",
    "common.actions": "Ações",
    "common.yes": "Sim",
    "common.no": "Não",
    "nav.dashboard": "Painel",
    "nav.leads": "Leads",
    "nav.contacts": "Contatos",
    "nav.companies": "Empresas",
    "nav.deals": "Negócios",
    "nav.tasks": "Tarefas",
    "nav.settings": "Configuração",
    "settings.language": "Idioma",
    "language.pt": "Português",
    "language.en": "Inglês",
    "language.es": "Espanhol",
  },
  en: {
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.loading": "Loading…",
    "common.search": "Search",
    "common.actions": "Actions",
    "common.yes": "Yes",
    "common.no": "No",
    "nav.dashboard": "Dashboard",
    "nav.leads": "Leads",
    "nav.contacts": "Contacts",
    "nav.companies": "Companies",
    "nav.deals": "Deals",
    "nav.tasks": "Tasks",
    "nav.settings": "Settings",
    "settings.language": "Language",
    "language.pt": "Portuguese",
    "language.en": "English",
    "language.es": "Spanish",
  },
  es: {
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.create": "Crear",
    "common.loading": "Cargando…",
    "common.search": "Buscar",
    "common.actions": "Acciones",
    "common.yes": "Sí",
    "common.no": "No",
    "nav.dashboard": "Panel",
    "nav.leads": "Leads",
    "nav.contacts": "Contactos",
    "nav.companies": "Empresas",
    "nav.deals": "Negocios",
    "nav.tasks": "Tareas",
    "nav.settings": "Configuración",
    "settings.language": "Idioma",
    "language.pt": "Portugués",
    "language.en": "Inglés",
    "language.es": "Español",
  },
};

const KEY = "lovable.locale";
const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (k: string) => string;
} | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pt");
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY) as Locale | null;
      if (v && dict[v]) setLocaleState(v);
    } catch {
      /* ignore */
    }
  }, []);
  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  };
  const t = (k: string) => dict[locale][k] ?? dict.pt[k] ?? k;
  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx)
    return { locale: "pt" as Locale, setLocale: () => {}, t: (k: string) => dict.pt[k] ?? k };
  return ctx;
}
