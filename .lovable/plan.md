# Reorganização do menu (sidebar + /settings)

## Diagnóstico atual

A sidebar tem 8 grupos e o grupo **Configuração** virou um "depósito" com 15 itens misturando: estrutura de CRM (Pipelines, Propriedades, Objetos custom), segurança (Usuários, Permissões, Auditoria, 2FA, API Keys), integrações (Email, Webhooks, HubSpot, Integrações) e preferências (Idioma, Mobile, White-label).

A aba interna `/settings` (top tabs) também mistura **Perfil pessoal** com **Pipelines** e **Usuários do workspace** — três escopos diferentes (eu / workspace / segurança) em um único nível.

Problemas centrais:
1. **Mistura de escopo**: pessoal × workspace × plataforma no mesmo grupo.
2. **Mistura de domínio**: CRM-config (Pipelines) ao lado de Segurança (Usuários/Permissões).
3. **Itens "soltos"** dentro de Análises que são na verdade configuração (Metas, Exports, Enriquecimento, Calendários, Booking).
4. **Marketing × Automações × Vendas** com fronteiras pouco claras (Templates de email, Sequências, Recorrência).

---

## Proposta A — Por domínio de negócio (refino do atual)

Mantém a mentalidade atual mas separa **Configuração** em sub-domínios alinhados a cada área.

```text
Análises        → Painel, Dashboards, Relatórios, Analytics, Metas
CRM             → Leads, Contatos, Empresas, Negócios, Tarefas, Filas, Listas
Vendas          → Produtos, Cotações, Assinaturas eletrônicas, Recorrência
Suporte         → Tickets, Macros, Pesquisas, Portal do cliente
Inbox           → Comunicações, Email, WhatsApp, Notas
Marketing       → Campanhas WhatsApp/Email, Templates, Formulários,
                  Prospecting, Tipos de assinatura
Automações      → Workflows, Sequências, Distribuição, SLA, Pontuação, Playbooks
─────────────── (separador)
Configurações ▸ (uma única entrada que abre /settings com sub-abas agrupadas)
   ├ Workspace        → Marca/White-label, Idioma, Mobile/PWA, Calendários, Booking
   ├ Estrutura CRM    → Pipelines, Propriedades, Objetos custom, Fontes de lead, Enriquecimento
   ├ Pessoas & Acesso → Usuários, Permissões, Conexão de Email pessoal, 2FA pessoal
   ├ Segurança        → Auditoria, API Keys, Webhooks, Sessões
   ├ Integrações      → Integrações, Sync HubSpot, Email transacional
   └ Conta            → Perfil, Preferências, Notificações
```

- **Prós**: mudança incremental, mantém os 7 grupos de operação já conhecidos; só o "balde" de Configurações é reorganizado.
- **Contras**: a sidebar continua larga; itens de configuração que hoje "vazam" para Análises/Marketing/Vendas continuam vazando.

---

## Proposta B — Por jornada do usuário (Operação × Configuração × Pessoal)

Reduz a sidebar para **3 macro-seções** + uma 4ª só de admin. Cada item de `/settings` migra para o grupo de jornada certo.

```text
▼ Trabalhar (operação do dia-a-dia)
   Painel · Leads · Contatos · Empresas · Negócios · Tarefas · Tickets
   Inbox (Email, WhatsApp, Comunicações, Notas) · Listas

▼ Analisar
   Dashboards · Relatórios · Analytics · Metas · Exports agendados

▼ Engajar (saída ativa)
   Campanhas WhatsApp/Email · Sequências · Templates · Formulários ·
   Prospecting · Macros · Pesquisas · Portal

▼ Configurar  (só admin/manager — abre /settings)
   ├ Workspace        Marca, Idioma, Mobile, Calendários, Booking
   ├ Estrutura CRM    Pipelines, Propriedades, Objetos custom, Fontes,
                       Produtos, Cotações, Recorrência, eSign
   ├ Automação        Workflows, Distribuição, SLA, Scoring, Playbooks, Enriquecimento
   ├ Pessoas & Acesso Usuários, Permissões, Times
   ├ Segurança        2FA, Auditoria, API Keys, Webhooks
   └ Integrações      Conectores, HubSpot Sync, Email transacional

▼ Minha conta (rodapé / avatar)
   Perfil · Conexão de email pessoal · 2FA pessoal · Notificações · Preferências
```

- **Prós**: sidebar enxuta (4 grupos visíveis em vez de 8), separa claramente **o que eu faço** de **como o sistema é configurado**; resolve o caso "Pipelines ao lado de Usuários" colocando Pipelines em *Estrutura CRM* e Usuários em *Pessoas & Acesso*.
- **Contras**: usuários atuais precisam reaprender onde estão Produtos/Cotações (saem de "Vendas" e viram *Estrutura CRM*); exige um banner de "novidades" temporário.

---

## Proposta C — Híbrido por persona (Operacional / Comercial / Admin)

Pensado para CRMs onde o **vendedor**, o **gestor** e o **admin** usam telas muito diferentes. A sidebar destaca o que cada papel acessa.

```text
▼ Meu dia       (vendedor)
   Painel · Tarefas · Filas · Inbox · Leads · Negócios

▼ Pipeline      (gestor comercial)
   Leads · Contatos · Empresas · Negócios · Listas · Produtos · Cotações ·
   Recorrência · eSign

▼ Atendimento   (suporte)
   Tickets · Macros · Pesquisas · Portal

▼ Marketing
   Campanhas · Sequências · Templates · Formulários · Prospecting · Segmentos

▼ Inteligência
   Dashboards · Relatórios · Analytics · Metas · Exports · Enriquecimento

▼ Administração (gear no topo direito + rota /settings)
   ├ Workspace (Marca, Idioma, Mobile, Calendários, Booking)
   ├ Estrutura (Pipelines, Propriedades, Objetos, Fontes, Scoring, SLA, Rotação, Workflows, Playbooks)
   ├ Acesso (Usuários, Permissões)
   ├ Segurança (2FA, Auditoria, API Keys, Webhooks)
   └ Integrações (Conectores, HubSpot)

▸ Avatar (rodapé): Perfil, Email pessoal, 2FA, Notificações, Sair
```

- **Prós**: cada persona enxerga primeiro o que usa; **Administração some da sidebar principal** e vira um ícone de engrenagem — elimina poluição para vendedor.
- **Contras**: duplica alguns itens (Leads/Negócios aparecem em "Meu dia" *e* "Pipeline"); exige lógica de filtro por papel mais sofisticada e telemetria para validar.

---

## Comparativo rápido

| Critério                              | A (Domínio) | B (Jornada) | C (Persona) |
|---------------------------------------|-------------|-------------|-------------|
| Esforço de implementação              | Baixo       | Médio       | Alto        |
| Curva de reaprendizagem do usuário    | Baixa       | Média       | Alta        |
| Resolve "Pipelines × Usuários juntos" | Sim         | Sim         | Sim         |
| Reduz tamanho visual da sidebar       | Não         | **Sim**     | **Sim**     |
| Separa pessoal × workspace × admin    | Parcial     | **Sim**     | **Sim**     |
| Escala para novas features            | Médio       | **Bom**     | Bom         |

---

## Recomendação: **Proposta B — Jornada do usuário**

Justificativa:

1. **Resolve o problema raiz** que você apontou (Pipelines junto de Usuários). Em B, *Pipelines* fica em **Estrutura CRM** (modelagem de dados) e *Usuários* fica em **Pessoas & Acesso** (segurança/identidade) — escopos claramente distintos.
2. **Reduz carga cognitiva**: 4 grupos na sidebar em vez de 8, com *Configurar* concentrando tudo que é setup. Hoje o usuário precisa lembrar se "Metas" está em Análises ou Configuração; em B é sempre **Trabalhar/Analisar** para uso e **Configurar** para definir.
3. **Custo de mudança aceitável**: diferente de C, não exige duplicar itens nem implementar uma nova camada por persona; o controle de visibilidade por papel (`ADMIN_ONLY`/`MANAGER_PLUS`) que já existe continua valendo, só muda o agrupamento.
4. **Escalabilidade**: novas features de setup (ex.: provedores de IA, billing) entram naturalmente em uma sub-aba de *Configurar* sem inflar a sidebar.
5. **Espelha padrões consagrados** (HubSpot, Pipedrive, Linear): operação à esquerda sempre visível; configuração concentrada em uma área dedicada com sub-navegação própria; conta pessoal no avatar.

Se aprovar a **Proposta B**, o próximo plano detalhará: novo `app-sidebar.tsx` com 4 grupos, refatoração de `settings.tsx` com sub-abas agrupadas (Workspace / Estrutura CRM / Automação / Pessoas & Acesso / Segurança / Integrações), e mover Perfil/2FA pessoal/Email pessoal para um menu no avatar do rodapé.
