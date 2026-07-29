// Opções pré-definidas para a busca de prospects no Apollo.io.
// Cada opção mantém o `value` esperado pela API do Apollo e um `label` em PT-BR.

export type ApolloOption = { value: string; label: string };

export const SENIORITY_OPTIONS: ApolloOption[] = [
  { value: "owner", label: "Sócio / Owner" },
  { value: "founder", label: "Fundador" },
  { value: "c_suite", label: "C-Level (CEO, CFO, CTO...)" },
  { value: "partner", label: "Partner" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head" },
  { value: "director", label: "Diretor" },
  { value: "manager", label: "Gerente" },
  { value: "senior", label: "Sênior" },
  { value: "entry", label: "Analista / Júnior" },
  { value: "intern", label: "Estagiário" },
];

export const DEPARTMENT_OPTIONS: ApolloOption[] = [
  { value: "master_engineering_technical", label: "Engenharia / TI" },
  { value: "master_information_technology", label: "Tecnologia da Informação" },
  { value: "master_sales", label: "Vendas" },
  { value: "master_marketing", label: "Marketing" },
  { value: "master_operations", label: "Operações" },
  { value: "master_finance", label: "Financeiro" },
  { value: "master_human_resources", label: "RH / Pessoas" },
  { value: "master_legal", label: "Jurídico" },
  { value: "master_consulting", label: "Consultoria" },
  { value: "master_product", label: "Produto" },
  { value: "master_design", label: "Design" },
  { value: "master_support", label: "Atendimento / Suporte" },
  { value: "master_education", label: "Educação" },
  { value: "master_medical_health", label: "Saúde" },
];

export const EMPLOYEE_RANGE_OPTIONS: ApolloOption[] = [
  { value: "1,10", label: "1-10 funcionários" },
  { value: "11,20", label: "11-20 funcionários" },
  { value: "21,50", label: "21-50 funcionários" },
  { value: "51,100", label: "51-100 funcionários" },
  { value: "101,200", label: "101-200 funcionários" },
  { value: "201,500", label: "201-500 funcionários" },
  { value: "501,1000", label: "501-1.000 funcionários" },
  { value: "1001,5000", label: "1.001-5.000 funcionários" },
  { value: "5001,10000", label: "5.001-10.000 funcionários" },
  { value: "10001,1000000", label: "10.001+ funcionários" },
];

export const REVENUE_RANGE_OPTIONS: ApolloOption[] = [
  { value: "0,1000000", label: "Até US$ 1M" },
  { value: "1000000,10000000", label: "US$ 1M - 10M" },
  { value: "10000000,50000000", label: "US$ 10M - 50M" },
  { value: "50000000,100000000", label: "US$ 50M - 100M" },
  { value: "100000000,500000000", label: "US$ 100M - 500M" },
  { value: "500000000,1000000000", label: "US$ 500M - 1B" },
  { value: "1000000000,100000000000", label: "US$ 1B+" },
];

export const EMAIL_STATUS_OPTIONS: ApolloOption[] = [
  { value: "verified", label: "Verificado" },
  { value: "likely to engage", label: "Alta probabilidade" },
  { value: "guessed", label: "Estimado" },
  { value: "unavailable", label: "Indisponível" },
];

/**
 * Taxonomia de indústrias do Apollo.io (valor = termo aceito pela API,
 * label = tradução PT-BR exibida ao usuário).
 */
export const INDUSTRY_OPTIONS: ApolloOption[] = [
  { value: "information technology & services", label: "TI e serviços de tecnologia" },
  { value: "computer software", label: "Software" },
  { value: "internet", label: "Internet" },
  { value: "computer & network security", label: "Segurança da informação" },
  { value: "telecommunications", label: "Telecomunicações" },
  { value: "computer hardware", label: "Hardware" },
  { value: "semiconductors", label: "Semicondutores" },
  { value: "financial services", label: "Serviços financeiros" },
  { value: "banking", label: "Bancos" },
  { value: "insurance", label: "Seguros" },
  { value: "investment management", label: "Gestão de investimentos" },
  { value: "venture capital & private equity", label: "Venture capital e private equity" },
  { value: "accounting", label: "Contabilidade" },
  { value: "management consulting", label: "Consultoria empresarial" },
  { value: "marketing & advertising", label: "Marketing e publicidade" },
  { value: "public relations & communications", label: "Relações públicas e comunicação" },
  { value: "market research", label: "Pesquisa de mercado" },
  { value: "design", label: "Design" },
  { value: "graphic design", label: "Design gráfico" },
  { value: "media production", label: "Produção de mídia" },
  { value: "broadcast media", label: "Mídia e radiodifusão" },
  { value: "publishing", label: "Editorial e publicações" },
  { value: "entertainment", label: "Entretenimento" },
  { value: "music", label: "Música" },
  { value: "sports", label: "Esportes" },
  { value: "gambling & casinos", label: "Jogos e cassinos" },
  { value: "retail", label: "Varejo" },
  { value: "wholesale", label: "Atacado" },
  { value: "consumer goods", label: "Bens de consumo" },
  { value: "consumer services", label: "Serviços ao consumidor" },
  { value: "consumer electronics", label: "Eletrônicos de consumo" },
  { value: "apparel & fashion", label: "Moda e vestuário" },
  { value: "luxury goods & jewelry", label: "Luxo e joalheria" },
  { value: "cosmetics", label: "Cosméticos" },
  { value: "food & beverages", label: "Alimentos e bebidas" },
  { value: "food production", label: "Produção de alimentos" },
  { value: "restaurants", label: "Restaurantes" },
  { value: "supermarkets", label: "Supermercados" },
  { value: "hospitality", label: "Hotelaria" },
  { value: "leisure, travel & tourism", label: "Turismo e lazer" },
  { value: "airlines/aviation", label: "Aviação" },
  { value: "logistics & supply chain", label: "Logística e cadeia de suprimentos" },
  { value: "transportation/trucking/railroad", label: "Transporte e frotas" },
  { value: "maritime", label: "Marítimo e portuário" },
  { value: "warehousing", label: "Armazenagem" },
  { value: "package/freight delivery", label: "Entregas e frete" },
  { value: "automotive", label: "Automotivo" },
  { value: "machinery", label: "Máquinas e equipamentos" },
  { value: "industrial automation", label: "Automação industrial" },
  { value: "mechanical or industrial engineering", label: "Engenharia industrial" },
  { value: "electrical/electronic manufacturing", label: "Manufatura eletroeletrônica" },
  { value: "plastics", label: "Plásticos" },
  { value: "chemicals", label: "Química" },
  { value: "mining & metals", label: "Mineração e metalurgia" },
  { value: "oil & energy", label: "Petróleo e energia" },
  { value: "renewables & environment", label: "Energias renováveis e meio ambiente" },
  { value: "utilities", label: "Utilities (água, luz, gás)" },
  { value: "construction", label: "Construção civil" },
  { value: "building materials", label: "Materiais de construção" },
  { value: "civil engineering", label: "Engenharia civil" },
  { value: "architecture & planning", label: "Arquitetura e urbanismo" },
  { value: "real estate", label: "Imobiliário" },
  { value: "commercial real estate", label: "Imobiliário comercial" },
  { value: "facilities services", label: "Facilities e serviços prediais" },
  { value: "farming", label: "Agricultura" },
  { value: "ranching", label: "Pecuária" },
  { value: "dairy", label: "Laticínios" },
  { value: "fishery", label: "Pesca" },
  { value: "hospital & health care", label: "Hospitais e saúde" },
  { value: "medical practice", label: "Clínicas médicas" },
  { value: "medical devices", label: "Dispositivos médicos" },
  { value: "pharmaceuticals", label: "Farmacêutico" },
  { value: "biotechnology", label: "Biotecnologia" },
  { value: "mental health care", label: "Saúde mental" },
  { value: "veterinary", label: "Veterinária" },
  { value: "health, wellness & fitness", label: "Saúde, bem-estar e fitness" },
  { value: "education management", label: "Gestão educacional" },
  { value: "higher education", label: "Ensino superior" },
  { value: "primary/secondary education", label: "Ensino básico e médio" },
  { value: "e-learning", label: "Educação online (EAD)" },
  { value: "professional training & coaching", label: "Treinamento e coaching" },
  { value: "research", label: "Pesquisa e desenvolvimento" },
  { value: "human resources", label: "Recursos humanos" },
  { value: "staffing & recruiting", label: "Recrutamento e seleção" },
  { value: "outsourcing/offshoring", label: "Outsourcing / BPO" },
  { value: "legal services", label: "Serviços jurídicos" },
  { value: "law practice", label: "Escritórios de advocacia" },
  { value: "security & investigations", label: "Segurança e investigação" },
  { value: "defense & space", label: "Defesa e espacial" },
  { value: "aviation & aerospace", label: "Aeroespacial" },
  { value: "government administration", label: "Administração pública" },
  { value: "public policy", label: "Políticas públicas" },
  { value: "nonprofit organization management", label: "Organizações sem fins lucrativos" },
  { value: "philanthropy", label: "Filantropia" },
  { value: "religious institutions", label: "Instituições religiosas" },
  { value: "civic & social organization", label: "Organizações civis e sociais" },
  { value: "environmental services", label: "Serviços ambientais" },
  { value: "events services", label: "Eventos" },
  { value: "photography", label: "Fotografia" },
  { value: "printing", label: "Gráfica e impressão" },
  { value: "textiles", label: "Têxtil" },
  { value: "furniture", label: "Móveis" },
  { value: "paper & forest products", label: "Papel e celulose" },
  { value: "packaging & containers", label: "Embalagens" },
  { value: "import & export", label: "Importação e exportação" },
  { value: "wine & spirits", label: "Vinhos e destilados" },
  { value: "tobacco", label: "Tabaco" },
  { value: "translation & localization", label: "Tradução e localização" },
  { value: "writing & editing", label: "Redação e edição" },
  { value: "libraries", label: "Bibliotecas" },
  { value: "museums & institutions", label: "Museus e instituições culturais" },
  { value: "fine art", label: "Artes" },
  { value: "performing arts", label: "Artes cênicas" },
  { value: "animation", label: "Animação" },
  { value: "computer games", label: "Jogos digitais" },
  { value: "information services", label: "Serviços de informação" },
  { value: "program development", label: "Desenvolvimento de programas" },
  { value: "capital markets", label: "Mercado de capitais" },
  { value: "individual & family services", label: "Serviços a indivíduos e famílias" },
  { value: "alternative medicine", label: "Medicina alternativa" },
  { value: "sporting goods", label: "Artigos esportivos" },
  { value: "recreational facilities & services", label: "Lazer e recreação" },
  { value: "glass, ceramics & concrete", label: "Vidro, cerâmica e concreto" },
  { value: "shipbuilding", label: "Construção naval" },
  { value: "railroad manufacture", label: "Fabricação ferroviária" },
  { value: "nanotechnology", label: "Nanotecnologia" },
  { value: "wireless", label: "Telefonia e wireless" },
  { value: "think tanks", label: "Think tanks" },
  { value: "international affairs", label: "Relações internacionais" },
  { value: "judiciary", label: "Judiciário" },
  { value: "legislative office", label: "Legislativo" },
  { value: "military", label: "Militar" },
  { value: "law enforcement", label: "Segurança pública" },
  { value: "political organization", label: "Organizações políticas" },
];

export type ProspectFilters = {
  person_titles?: string[];
  person_not_titles?: string[];
  person_seniorities?: string[];
  person_departments?: string[];
  person_locations?: string[];
  organization_locations?: string[];
  organization_industry_keywords?: string[];
  organization_num_employees_ranges?: string[];
  organization_estimated_annual_revenue_ranges?: string[];
  organization_technology_uids?: string[];
  q_keywords?: string[];
  q_organization_keyword_tags?: string[];
  contact_email_status?: string[];
  organization_domains?: string[];
  organization_not_domains?: string[];
};

export const EMPTY_FILTERS: ProspectFilters = {};

export function countActiveFilters(f: ProspectFilters | null | undefined): number {
  if (!f) return 0;
  return Object.values(f).reduce((acc, v) => acc + (Array.isArray(v) && v.length > 0 ? 1 : 0), 0);
}

export function summarizeFilters(f: ProspectFilters | null | undefined): {
  industry: string;
  role_title: string;
  company_size: string;
  location: string;
  keywords: string;
} {
  const join = (arr?: string[]) => (arr && arr.length ? arr.join(", ") : "");
  return {
    industry: join(f?.organization_industry_keywords),
    role_title: join(f?.person_titles),
    company_size: join(
      f?.organization_num_employees_ranges?.map(
        (v) => EMPLOYEE_RANGE_OPTIONS.find((o) => o.value === v)?.label ?? v,
      ),
    ),
    location: join(f?.person_locations),
    keywords: join(f?.q_keywords),
  };
}
