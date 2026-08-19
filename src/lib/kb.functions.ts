// Server functions for Knowledge Base.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";

const KB_VIEW = ["techservice.kb.view.workspace", "techservice.kb.manage.workspace"];
const KB_CREATE = [
  "techservice.kb.create.own",
  "techservice.kb.update.workspace",
  "techservice.kb.manage.workspace",
];
const KB_UPDATE = ["techservice.kb.update.workspace", "techservice.kb.manage.workspace"];
const KB_DELETE = ["techservice.kb.delete.workspace", "techservice.kb.manage.workspace"];
const KB_MANAGE = ["techservice.kb.manage.workspace"];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "artigo";

// ========== ADMIN ==========

export const listKbCategoriesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, KB_VIEW);
    const { data, error } = await supabaseAdmin
      .from("kb_categories")
      .select("id, name, slug, description, position")
      .eq("owner_id", ws)
      .order("position", { ascending: true })
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertKbCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(100),
        slug: z.string().max(80).optional(),
        description: z.string().max(500).optional().nullable(),
        position: z.number().int().min(0).max(9999).default(0),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    await assertAnyPermission(
      context.supabase,
      context.userId,
      ws,
      data.id ? KB_UPDATE : KB_CREATE,
    );
    const slug = data.slug || slugify(data.name);
    const payload = {
      owner_id: ws,
      workspace_id: ws,
      name: data.name,
      slug,
      description: data.description ?? null,
      position: data.position,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("kb_categories")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", ws);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("kb_categories")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteKbCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, KB_DELETE);
    await supabaseAdmin.from("kb_categories").delete().eq("id", data.id).eq("owner_id", ws);
    return { ok: true };
  });

export const listKbArticlesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, KB_VIEW);
    const { data, error } = await supabaseAdmin
      .from("kb_articles")
      .select("id, title, slug, excerpt, category_id, published, published_at, views, updated_at")
      .eq("owner_id", ws)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getKbArticleAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, KB_VIEW);
    const { data: row, error } = await supabaseAdmin
      .from("kb_articles")
      .select("*")
      .eq("id", data.id)
      .eq("owner_id", ws)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Artigo não encontrado.");
    return row;
  });

export const upsertKbArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(2).max(200),
        slug: z.string().max(80).optional(),
        excerpt: z.string().max(500).optional().nullable(),
        body: z.string().max(50000).default(""),
        category_id: z.string().uuid().nullable().optional(),
        published: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    await assertAnyPermission(
      context.supabase,
      context.userId,
      ws,
      data.id ? KB_UPDATE : KB_CREATE,
    );
    const slug = data.slug || slugify(data.title);
    const payload = {
      owner_id: ws,
      title: data.title,
      slug,
      excerpt: data.excerpt ?? null,
      body: data.body,
      category_id: data.category_id ?? null,
      published: data.published,
      published_at: data.published ? new Date().toISOString() : null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("kb_articles")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", ws);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("kb_articles")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteKbArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, KB_DELETE);
    await supabaseAdmin.from("kb_articles").delete().eq("id", data.id).eq("owner_id", ws);
    return { ok: true };
  });

// ========== SEED — base inicial (≥10 artigos essenciais) ==========

const STARTER_CATEGORIES: Array<{ name: string; description: string }> = [
  { name: "Começando", description: "Primeiros passos para configurar e usar o CRM." },
  { name: "Vendas", description: "Pipelines, negócios, cotações e propostas." },
  { name: "Atendimento", description: "Tickets, inbox e portal do cliente." },
  { name: "Administração", description: "Workspace, usuários, billing e segurança." },
];

const STARTER_ARTICLES: Array<{ category: string; title: string; excerpt: string; body: string }> =
  [
    {
      category: "Começando",
      title: "Bem-vindo ao CRM",
      excerpt: "Visão geral da plataforma e principais módulos.",
      body: "# Bem-vindo\n\nO CRM organiza leads, contatos, empresas e negócios em um pipeline de vendas. Use o menu lateral para navegar entre os módulos.",
    },
    {
      category: "Começando",
      title: "Convidando usuários para o workspace",
      excerpt: "Como adicionar colegas ao seu workspace.",
      body: "# Convidar usuários\n\nAcesse **Configurações → Time** e clique em *Convidar usuário*. Defina o papel (Admin, Membro, Leitura) e envie o convite por e-mail.",
    },
    {
      category: "Começando",
      title: "Importando contatos via CSV",
      excerpt: "Importação em massa de contatos e empresas.",
      body: "# Importar CSV\n\nEm **Configurações → Importar CSV**, escolha a entidade (contatos, empresas, leads), mapeie as colunas do arquivo e confirme. Linhas inválidas são ignoradas com relatório.",
    },
    {
      category: "Vendas",
      title: "Configurando seu pipeline",
      excerpt: "Crie estágios e regras para seu funil de vendas.",
      body: "# Pipeline\n\nEm **Configurações → Pipelines**, crie um pipeline, defina estágios com probabilidade e mova negócios via kanban em **Negócios**.",
    },
    {
      category: "Vendas",
      title: "Criando e enviando cotações",
      excerpt: "Monte uma cotação a partir do catálogo de produtos.",
      body: "# Cotações\n\nAbra um negócio e clique em *Nova cotação*. Adicione itens do catálogo, defina desconto/imposto e envie por e-mail. O cliente assina e paga pelo link público.",
    },
    {
      category: "Vendas",
      title: "Atribuição de leads e rotação",
      excerpt: "Distribua leads automaticamente entre o time.",
      body: "# Rotação\n\nEm **Configurações → Rotação**, defina regras (round-robin, por região, por origem). Leads novos serão atribuídos automaticamente.",
    },
    {
      category: "Atendimento",
      title: "Trabalhando com tickets",
      excerpt: "Abra, atribua e responda chamados de clientes.",
      body: "# Tickets\n\nEm **Tickets**, abra novos chamados, atribua a um agente, defina prioridade e responda direto pelo timeline. SLAs podem ser configurados em **Configurações → SLA**.",
    },
    {
      category: "Atendimento",
      title: "Inbox unificado: e-mail, WhatsApp e chat",
      excerpt: "Atenda todos os canais em um só lugar.",
      body: "# Inbox\n\nEm **Inbox**, veja conversas de e-mail, WhatsApp e chat ao vivo. Responda direto pela plataforma e converta conversas em tickets ou contatos.",
    },
    {
      category: "Atendimento",
      title: "Portal do cliente",
      excerpt: "Permita que clientes vejam negócios e faturas.",
      body: "# Portal\n\nGere um link de portal para cada cliente em **Configurações → Portal**. Ele verá negócios em aberto, cotações, faturas e poderá abrir tickets.",
    },
    {
      category: "Administração",
      title: "Planos e cobrança",
      excerpt: "Como mudar de plano e ver consumo.",
      body: "# Billing\n\nEm **Configurações → Planos e cobrança**, veja seu plano atual, consumo do mês e faça upgrade/downgrade. Pagamentos via Stripe ou gateways BR.",
    },
    {
      category: "Administração",
      title: "Privacidade e LGPD",
      excerpt: "Exportar dados e excluir conta.",
      body: "# Privacidade\n\nEm **Configurações → Privacidade & Meus Dados** você pode exportar todos os seus dados em JSON e solicitar a exclusão da conta conforme LGPD.",
    },
    {
      category: "Administração",
      title: "Segurança: 2FA, SSO e auditoria",
      excerpt: "Endureça a segurança do seu workspace.",
      body: "# Segurança\n\nAtive 2FA em **Configurações → Segurança**, configure SSO/SAML em **SSO** e revise o log de auditoria em **Audit log**.",
    },
  ];

export const seedStarterKb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, KB_MANAGE);



    // Cria categorias (idempotente por slug)
    const catBySlug = new Map<string, string>();
    for (const c of STARTER_CATEGORIES) {
      const slug = slugify(c.name);
      const { data: existing } = await supabaseAdmin
        .from("kb_categories")
        .select("id")
        .eq("owner_id", ws)
        .eq("slug", slug)
        .maybeSingle();
      if (existing?.id) {
        catBySlug.set(c.name, existing.id);
        continue;
      }
      const { data: ins, error } = await supabaseAdmin
        .from("kb_categories")
        .insert({
          owner_id: ws,
          workspace_id: ws,
          name: c.name,
          slug,
          description: c.description,
          position: 0,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      catBySlug.set(c.name, ins.id);
    }

    let created = 0;
    let skipped = 0;
    for (const a of STARTER_ARTICLES) {
      const slug = slugify(a.title);
      const { data: existing } = await supabaseAdmin
        .from("kb_articles")
        .select("id")
        .eq("owner_id", ws)
        .eq("slug", slug)
        .maybeSingle();
      if (existing?.id) {
        skipped++;
        continue;
      }
      const { error } = await supabaseAdmin.from("kb_articles").insert({
        owner_id: ws,
        category_id: catBySlug.get(a.category) ?? null,
        slug,
        title: a.title,
        excerpt: a.excerpt,
        body: a.body,
        published: true,
        published_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      created++;
    }
    return { created, skipped, total: STARTER_ARTICLES.length };
  });

// ========== PÚBLICO (qualquer um) ==========

export const listKbPublic = createServerFn({ method: "GET" }).handler(async () => {
  // Lista todos os artigos publicados de todos workspaces (KB pública multi-tenant simples)
  const [cats, arts] = await Promise.all([
    supabaseAdmin
      .from("kb_categories")
      .select("id, name, slug, description, owner_id")
      .order("position"),
    supabaseAdmin
      .from("kb_articles")
      .select("id, title, slug, excerpt, category_id, published_at, views, owner_id")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(500),
  ]);
  return { categories: cats.data ?? [], articles: arts.data ?? [] };
});

export const getKbArticlePublic = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ slug: z.string().min(1).max(80) }).parse(i))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("kb_articles")
      .select("id, title, slug, excerpt, body, category_id, published_at, views")
      .eq("published", true)
      .eq("slug", data.slug)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Artigo não encontrado.");
    // Increment views (best-effort)
    await supabaseAdmin
      .from("kb_articles")
      .update({ views: (row.views ?? 0) + 1 })
      .eq("id", row.id);
    return row;
  });
