// De->Para de fontes de lead (HubSpot/legado em inglês) para rótulos em pt-BR.
const MAP: Record<string, string> = {
  DIRECT_TRAFFIC: "Tráfego direto",
  EMAIL_MARKETING: "Email marketing",
  OFFLINE: "Offline",
  ORGANIC_SEARCH: "Busca orgânica",
  OTHER_CAMPAIGNS: "Outras campanhas",
  PAID_SEARCH: "Busca paga",
  PAID_SOCIAL: "Social paga",
  ORGANIC_SOCIAL: "Social orgânica",
  REFERRALS: "Indicações",
  website: "Site",
  WEBSITE: "Site",
};

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function leadSourceLabel(name: string): string {
  if (!name) return "";
  return MAP[name] ?? MAP[name.toUpperCase()] ?? titleCase(name);
}
