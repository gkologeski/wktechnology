# Suíte de Casos de Teste — TechSales CRM

_Total: **595 casos** distribuídos em **23 módulos**._

Veja `docs/qa/README.md` para ambientes, contas seed, prioridades e fluxo de execução.

## Índice

- [1. Autenticação & Onboarding](#1-autentica-o-onboarding) — 25 casos
- [2. CRM Core (Leads/Contatos/Empresas/Negócios)](#2-crm-core-leads-contatos-empresas-neg-cios) — 48 casos
- [3. Pipelines & Deals](#3-pipelines-deals) — 25 casos
- [4. Tarefas, Atividades & Filas](#4-tarefas-atividades-filas) — 20 casos
- [5. Inbox Unificada](#5-inbox-unificada) — 30 casos
- [6. Campanhas (Email/WhatsApp/Prospecting)](#6-campanhas-email-whatsapp-prospecting) — 30 casos
- [7. Comunicação & Telefonia (Twilio/WhatsApp/Vapi)](#7-comunica-o-telefonia-twilio-whatsapp-vapi) — 20 casos
- [8. Reuniões / Calendário / Booking](#8-reuni-es-calend-rio-booking) — 25 casos
- [9. Marketing & Captação (Forms/LP/Survey/Widget/Ads)](#9-marketing-capta-o-forms-lp-survey-widget-ads) — 25 casos
- [10. Vendas Avançadas (Quotes/E-sign/Payments/NFSe)](#10-vendas-avan-adas-quotes-e-sign-payments-nfse) — 25 casos
- [11. Atendimento (Tickets/SLA/Macros/KB)](#11-atendimento-tickets-sla-macros-kb) — 15 casos
- [12. Knowledge Base & Portal](#12-knowledge-base-portal) — 10 casos
- [13. Automação (Workflows/Sequences/Scoring/AI)](#13-automa-o-workflows-sequences-scoring-ai) — 25 casos
- [14. Integrações & Marketplace](#14-integra-es-marketplace) — 25 casos
- [15. Settings](#15-settings) — 80 casos
- [16. Billing & Entitlements](#16-billing-entitlements) — 20 casos
- [17. Admin de Plataforma](#17-admin-de-plataforma) — 25 casos
- [18. Bug Reports (Usuário)](#18-bug-reports-usu-rio) — 5 casos
- [19. Rotas Públicas / Webhooks](#19-rotas-p-blicas-webhooks) — 25 casos
- [20. Cron / Hooks Agendados](#20-cron-hooks-agendados) — 42 casos
- [21. Segurança & Compliance](#21-seguran-a-compliance) — 25 casos
- [22. UX Transversal & Acessibilidade](#22-ux-transversal-acessibilidade) — 15 casos
- [23. Performance & Resiliência](#23-performance-resili-ncia) — 10 casos

## Legenda

- **Prioridade**: P0 (bloqueante), P1 (alta), P2 (média), P3 (baixa)
- **Tipo**: Funcional / UI / UX / Segurança / Permissão / Integração / Performance / Acessibilidade / Compliance / SEO / Resiliência
- **Smoke**: ✅ = compõe a suíte de regressão rápida (~50 casos P0/P1)

## 1. Autenticação & Onboarding

### QA-AUTH-001 — Login com credenciais válidas

- **Sub-módulo**: Login
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Usuário ativo existe (e-mail+senha) em um workspace
- **Passos**:
  1. Acessar /auth
  2. Selecionar aba 'Entrar'
  3. Informar e-mail e senha válidos
  4. Clicar em Entrar
- **Resultado esperado**: Redirecionar para /dashboard e exibir nome do usuário no header

### QA-AUTH-002 — Login com senha incorreta

- **Sub-módulo**: Login
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Usuário ativo existe
- **Passos**:
  1. Acessar /auth
  2. Informar e-mail correto e senha errada
  3. Clicar em Entrar
- **Resultado esperado**: Exibir toast/erro 'Credenciais inválidas' sem revelar se o e-mail existe

### QA-AUTH-003 — Login com e-mail inexistente

- **Sub-módulo**: Login
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Acessar /auth
  2. Informar e-mail nunca cadastrado
  3. Clicar em Entrar
- **Resultado esperado**: Exibir mensagem genérica de credenciais inválidas; não vazar existência da conta

### QA-AUTH-004 — Login OAuth Google

- **Sub-módulo**: Login
- **Prioridade**: P0 | **Tipo**: Integração | **Smoke**: ✅
- **Pré-condições**: Provedor Google habilitado em Auth
- **Passos**:
  1. Acessar /auth
  2. Clicar 'Continuar com Google'
  3. Autorizar conta Google
- **Resultado esperado**: Sessão criada e redirecionamento para /dashboard

### QA-AUTH-005 — Bloqueio após múltiplas tentativas

- **Sub-módulo**: Login
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Tentativas anteriores >5
- **Passos**:
  1. Tentar login com senha errada 6 vezes consecutivas
- **Resultado esperado**: Sistema exibe rate limit/aviso e bloqueia tentativas adicionais por janela

### QA-AUTH-006 — Cadastro de novo usuário e workspace

- **Sub-módulo**: Signup
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: E-mail novo
- **Passos**:
  1. Acessar /auth aba Criar conta
  2. Preencher nome, e-mail, senha forte
  3. Aceitar termos
  4. Submeter
- **Resultado esperado**: Conta criada, workspace default provisionado, usuário logado

### QA-AUTH-007 — Validação de senha fraca

- **Sub-módulo**: Signup
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Tentar criar conta com senha '123'
- **Resultado esperado**: Erro de validação de força de senha; cadastro bloqueado

### QA-AUTH-008 — E-mail já existente

- **Sub-módulo**: Signup
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Usuário existente
- **Passos**:
  1. Tentar cadastrar com e-mail já usado
- **Resultado esperado**: Erro claro 'E-mail já cadastrado'

### QA-AUTH-009 — Solicitar reset de senha

- **Sub-módulo**: Reset
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Conta existente
- **Passos**:
  1. Acessar /auth/reset-password
  2. Informar e-mail
  3. Submeter
- **Resultado esperado**: Receber e-mail com link de redefinição válido por tempo limitado

### QA-AUTH-010 — Redefinir senha com link

- **Sub-módulo**: Reset
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Token válido em e-mail
- **Passos**:
  1. Clicar link do e-mail
  2. Informar nova senha forte 2x
  3. Salvar
- **Resultado esperado**: Senha alterada; redirect para /auth com mensagem de sucesso

### QA-AUTH-011 — Token de reset expirado

- **Sub-módulo**: Reset
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Token >24h
- **Passos**:
  1. Abrir link expirado
- **Resultado esperado**: Mensagem 'Link expirado' e CTA para solicitar novo

### QA-AUTH-012 — Aceitar convite de workspace

- **Sub-módulo**: Invite
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Convite pendente em workspace_invites
- **Passos**:
  1. Abrir link /accept-invite/$token
  2. Logar/criar conta
  3. Confirmar
- **Resultado esperado**: Usuário vinculado ao workspace com role definida no convite

### QA-AUTH-013 — Convite expirado

- **Sub-módulo**: Invite
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: expires_at < now()
- **Passos**:
  1. Abrir link expirado
- **Resultado esperado**: Mensagem 'Convite expirado'; impedir entrada no workspace

### QA-AUTH-014 — Reenviar convite

- **Sub-módulo**: Invite
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin no workspace
- **Passos**:
  1. Settings > Equipe
  2. Localizar convite pendente
  3. Clicar Reenviar
- **Resultado esperado**: Novo e-mail enviado; expires_at atualizado

### QA-AUTH-015 — Verificação por hash

- **Sub-módulo**: Verify
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Link /verify/$hash válido
- **Passos**:
  1. Abrir /verify/$hash
- **Resultado esperado**: Marcar verificação como concluída; feedback de sucesso

### QA-AUTH-016 — Logout

- **Sub-módulo**: Sessão
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Usuário logado
- **Passos**:
  1. Abrir menu do avatar
  2. Clicar Sair
- **Resultado esperado**: Sessão encerrada; redirecionar para /auth; rotas protegidas inacessíveis

### QA-AUTH-017 — Sessão expirada em chamada server fn

- **Sub-módulo**: Sessão
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Sessão inválida
- **Passos**:
  1. Forçar expiração do token
  2. Disparar ação que chama serverFn protegida
- **Resultado esperado**: App detecta 401 e redireciona para /auth; sem erro genérico no console

### QA-AUTH-018 — Acesso a rota protegida sem login

- **Sub-módulo**: Sessão
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Sem sessão
- **Passos**:
  1. Abrir /dashboard diretamente
- **Resultado esperado**: Redirecionar para /auth?next=/dashboard

### QA-AUTH-019 — Trocar de workspace

- **Sub-módulo**: Workspace
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Usuário com 2+ workspaces
- **Passos**:
  1. Header > seletor de workspace
  2. Selecionar outro
- **Resultado esperado**: Dados recarregados (leads, deals) exibem apenas registros do workspace ativo

### QA-AUTH-020 — Isolamento RLS entre workspaces

- **Sub-módulo**: Workspace
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: 2 workspaces, IDs conhecidos
- **Passos**:
  1. Logado em WS-A
  2. Tentar acessar /contacts/$id de WS-B via URL direta
- **Resultado esperado**: Carregar como 'não encontrado'; nenhum vazamento de dado

### QA-AUTH-021 — Wizard inicial

- **Sub-módulo**: Onboarding
- **Prioridade**: P2 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: Workspace recém-criado
- **Passos**:
  1. Login pela primeira vez
- **Resultado esperado**: Wizard /onboarding/welcome guia setup; pode ser pulado

### QA-AUTH-022 — Onboarding já concluído

- **Sub-módulo**: Onboarding
- **Prioridade**: P2 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: Flag concluída
- **Passos**:
  1. Login novamente
- **Resultado esperado**: Pular onboarding; ir direto para /dashboard

### QA-AUTH-023 — Login com e-mail não confirmado

- **Sub-módulo**: Login
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Usuário sem confirmação
- **Passos**:
  1. Tentar login
- **Resultado esperado**: Bloquear e exibir CTA 'reenviar confirmação' (se confirm email ativo)

### QA-AUTH-024 — Persistência de sessão

- **Sub-módulo**: Login
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Login ok, fechar e reabrir aba
- **Passos**:
  1. Login
  2. Fechar aba
  3. Reabrir /dashboard
- **Resultado esperado**: Sessão persistida; usuário continua autenticado

### QA-AUTH-025 — CSRF/origin em login

- **Sub-módulo**: Login
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Inspecionar requests de login
- **Resultado esperado**: Token Supabase enviado via HTTPS; sem credenciais em querystring

## 2. CRM Core (Leads/Contatos/Empresas/Negócios)

### QA-CRM-001 — Listar Lead

- **Sub-módulo**: Lead
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Existem ≥3 Leads
- **Passos**:
  1. Acessar /leads
- **Resultado esperado**: Tabela exibida com paginação, colunas-padrão e ordenação por updated_at desc

### QA-CRM-002 — Criar Lead com campos obrigatórios

- **Sub-módulo**: Lead
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Role com permissão de escrita
- **Passos**:
  1. Acessar /leads
  2. Clicar 'Novo'
  3. Preencher nome, e-mail, telefone, fonte
  4. Salvar
- **Resultado esperado**: Registro criado, aparece no topo da lista; toast de sucesso

### QA-CRM-003 — Criar Lead sem obrigatórios

- **Sub-módulo**: Lead
- **Prioridade**: P1 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Abrir formulário
  2. Deixar campos obrigatórios vazios
  3. Salvar
- **Resultado esperado**: Erros de validação inline; nenhuma chamada de servidor disparada

### QA-CRM-004 — Editar Lead

- **Sub-módulo**: Lead
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Lead existente
- **Passos**:
  1. Abrir detalhe
  2. Alterar 2 campos
  3. Salvar
- **Resultado esperado**: Alterações persistidas; property_history registra mudanças

### QA-CRM-005 — Excluir Lead

- **Sub-módulo**: Lead
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Lead sem dependências
- **Passos**:
  1. Abrir detalhe
  2. Menu > Excluir
  3. Confirmar
- **Resultado esperado**: Registro removido; redireciona para lista; auditoria gerada

### QA-CRM-006 — Filtros e busca em Lead

- **Sub-módulo**: Lead
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Dados variados
- **Passos**:
  1. Acessar lista
  2. Aplicar filtro por proprietário e status
  3. Buscar por nome
- **Resultado esperado**: Resultados filtrados consistentes; URL reflete filtros (saved view)

### QA-CRM-007 — Saved view de Lead

- **Sub-módulo**: Lead
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Filtros aplicados
- **Passos**:
  1. Aplicar filtros
  2. Salvar como view
  3. Recarregar página
- **Resultado esperado**: View aparece em saved_views e é restaurada ao reabrir

### QA-CRM-008 — Exportar Lead para CSV

- **Sub-módulo**: Lead
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Lista com >1 item
- **Passos**:
  1. Lista > menu > Exportar CSV
- **Resultado esperado**: Download de CSV com colunas visíveis e respeito ao filtro atual

### QA-CRM-009 — Importar Lead via CSV

- **Sub-módulo**: Lead
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Arquivo modelo
- **Passos**:
  1. Settings > Importar CSV
  2. Upload
  3. Mapear colunas
  4. Confirmar
- **Resultado esperado**: Registros criados; relatório com sucesso/erros por linha

### QA-CRM-010 — RLS leitura Lead de outro workspace

- **Sub-módulo**: Lead
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Dois workspaces
- **Passos**:
  1. Logar em WS-A
  2. Tentar GET /contacts/$id (id do WS-B)
- **Resultado esperado**: 404 ou vazio; logs sem leak; nenhum dado retornado

### QA-CRM-011 — Listar Contato

- **Sub-módulo**: Contato
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Existem ≥3 Contatos
- **Passos**:
  1. Acessar /contacts
- **Resultado esperado**: Tabela exibida com paginação, colunas-padrão e ordenação por updated_at desc

### QA-CRM-012 — Criar Contato com campos obrigatórios

- **Sub-módulo**: Contato
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Role com permissão de escrita
- **Passos**:
  1. Acessar /contacts
  2. Clicar 'Novo'
  3. Preencher nome, e-mail, telefone, empresa
  4. Salvar
- **Resultado esperado**: Registro criado, aparece no topo da lista; toast de sucesso

### QA-CRM-013 — Criar Contato sem obrigatórios

- **Sub-módulo**: Contato
- **Prioridade**: P1 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Abrir formulário
  2. Deixar campos obrigatórios vazios
  3. Salvar
- **Resultado esperado**: Erros de validação inline; nenhuma chamada de servidor disparada

### QA-CRM-014 — Editar Contato

- **Sub-módulo**: Contato
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Contato existente
- **Passos**:
  1. Abrir detalhe
  2. Alterar 2 campos
  3. Salvar
- **Resultado esperado**: Alterações persistidas; property_history registra mudanças

### QA-CRM-015 — Excluir Contato

- **Sub-módulo**: Contato
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Contato sem dependências
- **Passos**:
  1. Abrir detalhe
  2. Menu > Excluir
  3. Confirmar
- **Resultado esperado**: Registro removido; redireciona para lista; auditoria gerada

### QA-CRM-016 — Filtros e busca em Contato

- **Sub-módulo**: Contato
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Dados variados
- **Passos**:
  1. Acessar lista
  2. Aplicar filtro por proprietário e status
  3. Buscar por nome
- **Resultado esperado**: Resultados filtrados consistentes; URL reflete filtros (saved view)

### QA-CRM-017 — Saved view de Contato

- **Sub-módulo**: Contato
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Filtros aplicados
- **Passos**:
  1. Aplicar filtros
  2. Salvar como view
  3. Recarregar página
- **Resultado esperado**: View aparece em saved_views e é restaurada ao reabrir

### QA-CRM-018 — Exportar Contato para CSV

- **Sub-módulo**: Contato
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Lista com >1 item
- **Passos**:
  1. Lista > menu > Exportar CSV
- **Resultado esperado**: Download de CSV com colunas visíveis e respeito ao filtro atual

### QA-CRM-019 — Importar Contato via CSV

- **Sub-módulo**: Contato
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Arquivo modelo
- **Passos**:
  1. Settings > Importar CSV
  2. Upload
  3. Mapear colunas
  4. Confirmar
- **Resultado esperado**: Registros criados; relatório com sucesso/erros por linha

### QA-CRM-020 — RLS leitura Contato de outro workspace

- **Sub-módulo**: Contato
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Dois workspaces
- **Passos**:
  1. Logar em WS-A
  2. Tentar GET /contacts/$id (id do WS-B)
- **Resultado esperado**: 404 ou vazio; logs sem leak; nenhum dado retornado

### QA-CRM-021 — Listar Empresa

- **Sub-módulo**: Empresa
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Existem ≥3 Empresas
- **Passos**:
  1. Acessar /companies
- **Resultado esperado**: Tabela exibida com paginação, colunas-padrão e ordenação por updated_at desc

### QA-CRM-022 — Criar Empresa com campos obrigatórios

- **Sub-módulo**: Empresa
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Role com permissão de escrita
- **Passos**:
  1. Acessar /companies
  2. Clicar 'Novo'
  3. Preencher nome, domínio, segmento
  4. Salvar
- **Resultado esperado**: Registro criado, aparece no topo da lista; toast de sucesso

### QA-CRM-023 — Criar Empresa sem obrigatórios

- **Sub-módulo**: Empresa
- **Prioridade**: P1 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Abrir formulário
  2. Deixar campos obrigatórios vazios
  3. Salvar
- **Resultado esperado**: Erros de validação inline; nenhuma chamada de servidor disparada

### QA-CRM-024 — Editar Empresa

- **Sub-módulo**: Empresa
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Empresa existente
- **Passos**:
  1. Abrir detalhe
  2. Alterar 2 campos
  3. Salvar
- **Resultado esperado**: Alterações persistidas; property_history registra mudanças

### QA-CRM-025 — Excluir Empresa

- **Sub-módulo**: Empresa
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Empresa sem dependências
- **Passos**:
  1. Abrir detalhe
  2. Menu > Excluir
  3. Confirmar
- **Resultado esperado**: Registro removido; redireciona para lista; auditoria gerada

### QA-CRM-026 — Filtros e busca em Empresa

- **Sub-módulo**: Empresa
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Dados variados
- **Passos**:
  1. Acessar lista
  2. Aplicar filtro por proprietário e status
  3. Buscar por nome
- **Resultado esperado**: Resultados filtrados consistentes; URL reflete filtros (saved view)

### QA-CRM-027 — Saved view de Empresa

- **Sub-módulo**: Empresa
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Filtros aplicados
- **Passos**:
  1. Aplicar filtros
  2. Salvar como view
  3. Recarregar página
- **Resultado esperado**: View aparece em saved_views e é restaurada ao reabrir

### QA-CRM-028 — Exportar Empresa para CSV

- **Sub-módulo**: Empresa
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Lista com >1 item
- **Passos**:
  1. Lista > menu > Exportar CSV
- **Resultado esperado**: Download de CSV com colunas visíveis e respeito ao filtro atual

### QA-CRM-029 — Importar Empresa via CSV

- **Sub-módulo**: Empresa
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Arquivo modelo
- **Passos**:
  1. Settings > Importar CSV
  2. Upload
  3. Mapear colunas
  4. Confirmar
- **Resultado esperado**: Registros criados; relatório com sucesso/erros por linha

### QA-CRM-030 — RLS leitura Empresa de outro workspace

- **Sub-módulo**: Empresa
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Dois workspaces
- **Passos**:
  1. Logar em WS-A
  2. Tentar GET /contacts/$id (id do WS-B)
- **Resultado esperado**: 404 ou vazio; logs sem leak; nenhum dado retornado

### QA-CRM-031 — Listar Negócio

- **Sub-módulo**: Negócio
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Existem ≥3 Negócios
- **Passos**:
  1. Acessar /deals
- **Resultado esperado**: Tabela exibida com paginação, colunas-padrão e ordenação por updated_at desc

### QA-CRM-032 — Criar Negócio com campos obrigatórios

- **Sub-módulo**: Negócio
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Role com permissão de escrita
- **Passos**:
  1. Acessar /deals
  2. Clicar 'Novo'
  3. Preencher título, valor, pipeline, stage, contato
  4. Salvar
- **Resultado esperado**: Registro criado, aparece no topo da lista; toast de sucesso

### QA-CRM-033 — Criar Negócio sem obrigatórios

- **Sub-módulo**: Negócio
- **Prioridade**: P1 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Abrir formulário
  2. Deixar campos obrigatórios vazios
  3. Salvar
- **Resultado esperado**: Erros de validação inline; nenhuma chamada de servidor disparada

### QA-CRM-034 — Editar Negócio

- **Sub-módulo**: Negócio
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Negócio existente
- **Passos**:
  1. Abrir detalhe
  2. Alterar 2 campos
  3. Salvar
- **Resultado esperado**: Alterações persistidas; property_history registra mudanças

### QA-CRM-035 — Excluir Negócio

- **Sub-módulo**: Negócio
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Negócio sem dependências
- **Passos**:
  1. Abrir detalhe
  2. Menu > Excluir
  3. Confirmar
- **Resultado esperado**: Registro removido; redireciona para lista; auditoria gerada

### QA-CRM-036 — Filtros e busca em Negócio

- **Sub-módulo**: Negócio
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Dados variados
- **Passos**:
  1. Acessar lista
  2. Aplicar filtro por proprietário e status
  3. Buscar por nome
- **Resultado esperado**: Resultados filtrados consistentes; URL reflete filtros (saved view)

### QA-CRM-037 — Saved view de Negócio

- **Sub-módulo**: Negócio
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Filtros aplicados
- **Passos**:
  1. Aplicar filtros
  2. Salvar como view
  3. Recarregar página
- **Resultado esperado**: View aparece em saved_views e é restaurada ao reabrir

### QA-CRM-038 — Exportar Negócio para CSV

- **Sub-módulo**: Negócio
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Lista com >1 item
- **Passos**:
  1. Lista > menu > Exportar CSV
- **Resultado esperado**: Download de CSV com colunas visíveis e respeito ao filtro atual

### QA-CRM-039 — Importar Negócio via CSV

- **Sub-módulo**: Negócio
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Arquivo modelo
- **Passos**:
  1. Settings > Importar CSV
  2. Upload
  3. Mapear colunas
  4. Confirmar
- **Resultado esperado**: Registros criados; relatório com sucesso/erros por linha

### QA-CRM-040 — RLS leitura Negócio de outro workspace

- **Sub-módulo**: Negócio
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Dois workspaces
- **Passos**:
  1. Logar em WS-A
  2. Tentar GET /contacts/$id (id do WS-B)
- **Resultado esperado**: 404 ou vazio; logs sem leak; nenhum dado retornado

### QA-CRM-041 — Converter Lead em Contato/Empresa/Deal

- **Sub-módulo**: Conversão
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Lead qualificado
- **Passos**:
  1. Abrir lead
  2. Botão Converter
  3. Selecionar pipeline e contato
- **Resultado esperado**: Cria contact/company/deal vinculados; lead marcado convertido; vínculo em property_history

### QA-CRM-042 — Identificar duplicado por e-mail

- **Sub-módulo**: Deduplicação
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Contato existente com mesmo e-mail
- **Passos**:
  1. Criar contato com e-mail já existente
- **Resultado esperado**: Aviso de duplicado com opção de mesclar

### QA-CRM-043 — Mesclar contatos duplicados

- **Sub-módulo**: Deduplicação
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: 2 contatos similares
- **Passos**:
  1. Selecionar 2 contatos
  2. Mesclar
  3. Escolher mestre
- **Resultado esperado**: Mesclagem persiste; histórico preservado; atividades transferidas

### QA-CRM-044 — Criar custom property

- **Sub-módulo**: Propriedades
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Settings > Propriedades > Nova
  2. Tipo string
  3. Aplicar a Contato
  4. Salvar
- **Resultado esperado**: Propriedade aparece em formulários e filtros de Contato

### QA-CRM-045 — Validação de tipo em custom property numérica

- **Sub-módulo**: Propriedades
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: Property numérica
- **Passos**:
  1. Editar contato
  2. Informar texto no campo numérico
- **Resultado esperado**: Erro de validação; valor não persistido

### QA-CRM-046 — Auditoria de alteração de propriedade

- **Sub-módulo**: Histórico
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Contato existente
- **Passos**:
  1. Alterar campo telefone
  2. Abrir aba Histórico
- **Resultado esperado**: Entrada com usuário, timestamp, valor antigo→novo

### QA-CRM-047 — Paginação consistente

- **Sub-módulo**: Paginação
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: 100+ registros
- **Passos**:
  1. Lista > página 2
  2. Filtrar
  3. Voltar para página 1
- **Resultado esperado**: Estado de filtro e ordenação preservados; sem perda de seleção indevida

### QA-CRM-048 — Lista de 10k leads

- **Sub-módulo**: Performance
- **Prioridade**: P2 | **Tipo**: Performance | **Smoke**: —
- **Pré-condições**: Massa de dados
- **Passos**:
  1. Acessar /leads
- **Resultado esperado**: Carregamento inicial <3s; rolagem/virtualização fluida

## 3. Pipelines & Deals

### QA-PIPE-001 — Criar pipeline

- **Sub-módulo**: Pipeline
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Admin
- **Passos**:
  1. Settings > Pipelines > Novo
  2. Nome, stages
  3. Salvar
- **Resultado esperado**: Pipeline disponível ao criar deal

### QA-PIPE-002 — Editar/reordenar stages

- **Sub-módulo**: Pipeline
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Pipeline existente
- **Passos**:
  1. Editar pipeline
  2. Arrastar stages
  3. Salvar
- **Resultado esperado**: Ordem persistida e refletida no Kanban

### QA-PIPE-003 — Excluir pipeline com deals

- **Sub-módulo**: Pipeline
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Pipeline com deals
- **Passos**:
  1. Tentar excluir
- **Resultado esperado**: Bloqueado com mensagem ou exigir migração de deals

### QA-PIPE-004 — Drag-drop entre stages

- **Sub-módulo**: Kanban
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Deal existente
- **Passos**:
  1. Acessar Kanban
  2. Arrastar deal de A→B
- **Resultado esperado**: stage_entries grava entrada/saída; valor de stage atualizado; otimismo de UI

### QA-PIPE-005 — Drag-drop bloqueado por permissão

- **Sub-módulo**: Kanban
- **Prioridade**: P1 | **Tipo**: Permissão | **Smoke**: —
- **Pré-condições**: Role 'viewer'
- **Passos**:
  1. Logado como viewer
  2. Tentar arrastar
- **Resultado esperado**: Operação bloqueada; cursor indica não permitido

### QA-PIPE-006 — Adicionar line items

- **Sub-módulo**: Deal
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Deal existente, produtos cadastrados
- **Passos**:
  1. Detalhe do deal
  2. Aba produtos
  3. Adicionar 2 itens
- **Resultado esperado**: Soma de valores atualiza total do deal; deal_line_items persistidos

### QA-PIPE-007 — Recalcular valor com desconto

- **Sub-módulo**: Deal
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Line items
- **Passos**:
  1. Aplicar desconto 10% em item
- **Resultado esperado**: Valor recalculado e exibido com formatação correta

### QA-PIPE-008 — Forecast por pipeline

- **Sub-módulo**: Forecast
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Deals em vários stages
- **Passos**:
  1. Acessar /forecast
- **Resultado esperado**: Soma ponderada por probabilidade exibida; export disponível

### QA-PIPE-009 — Score de forecast (ml_forecast_scores)

- **Sub-módulo**: ML
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Modelo treinado
- **Passos**:
  1. Abrir deal
  2. Visualizar campo probabilidade IA
- **Resultado esperado**: Score exibido com explicação; sem erro se modelo indisponível

### QA-PIPE-010 — Regra de rotação por round-robin

- **Sub-módulo**: Rotação
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Regra ativa
- **Passos**:
  1. Criar lead via form público
- **Resultado esperado**: Lead atribuído ao próximo SDR conforme rotation_rules

### QA-PIPE-011 — Pular usuário inativo na rotação

- **Sub-módulo**: Rotação
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: SDR desativado
- **Passos**:
  1. Disparar nova rotação
- **Resultado esperado**: Usuário inativo ignorado; próximo elegível selecionado

### QA-PIPE-012 — Criar meta de receita

- **Sub-módulo**: Goals
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Settings > Goals > Nova
  2. Período mensal
  3. Tipo receita
  4. Salvar
- **Resultado esperado**: Meta exibida no dashboard com progresso

### QA-PIPE-013 — Cálculo de atingimento

- **Sub-módulo**: Goals
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Deals ganhos no período
- **Passos**:
  1. Atualizar deal para 'won'
- **Resultado esperado**: Barra de progresso da meta avança proporcionalmente

### QA-PIPE-014 — Permissões por role no pipeline

- **Sub-módulo**: Pipeline
- **Prioridade**: P1 | **Tipo**: Permissão | **Smoke**: —
- **Pré-condições**: Role 'sales'
- **Passos**:
  1. Tentar editar pipeline como sales
- **Resultado esperado**: Bloqueado; somente admin/owner editam

### QA-PIPE-015 — Múltiplos pipelines simultâneos

- **Sub-módulo**: Pipeline
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: 2 pipelines
- **Passos**:
  1. Trocar de pipeline no seletor
- **Resultado esperado**: Lista de deals e Kanban refletem o pipeline selecionado

### QA-PIPE-016 — Histórico de mudança de stage

- **Sub-módulo**: Deal
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Deal movimentado
- **Passos**:
  1. Abrir aba histórico
- **Resultado esperado**: Lista cronológica de stage_entries com usuário e timestamp

### QA-PIPE-017 — Reabrir deal perdido

- **Sub-módulo**: Deal
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Deal lost
- **Passos**:
  1. Mudar status para 'open'
  2. Selecionar stage
- **Resultado esperado**: Stage histórico restaurado; campo lost_reason limpo

### QA-PIPE-018 — Permissão de edição cross-owner

- **Sub-módulo**: Deal
- **Prioridade**: P1 | **Tipo**: Permissão | **Smoke**: —
- **Pré-condições**: Role sales
- **Passos**:
  1. Tentar editar deal de outro vendedor
- **Resultado esperado**: Política aplica: bloqueia ou permite conforme RLS configurada

### QA-PIPE-019 — Anexar atividade ao deal

- **Sub-módulo**: Deal
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Deal existente
- **Passos**:
  1. Criar tarefa vinculada
- **Resultado esperado**: Tarefa aparece na timeline do deal

### QA-PIPE-020 — Notas internas

- **Sub-módulo**: Deal
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Deal existente
- **Passos**:
  1. Adicionar nota com @menção
- **Resultado esperado**: Menção dispara notificação ao usuário citado

### QA-PIPE-021 — Filtros de período no forecast

- **Sub-módulo**: Forecast
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Trocar período do filtro
- **Resultado esperado**: Dados recarregados sem refresh manual; estados de loading

### QA-PIPE-022 — Limites de stage (WIP)

- **Sub-módulo**: Kanban
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Stage com limite
- **Passos**:
  1. Arrastar excedendo WIP
- **Resultado esperado**: Aviso visual; permite com confirmação ou bloqueia conforme config

### QA-PIPE-023 — Probabilidade por stage

- **Sub-módulo**: Pipeline
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Stages com %
- **Passos**:
  1. Editar stage e ajustar %
- **Resultado esperado**: Probabilidade afeta cálculo de forecast

### QA-PIPE-024 — Won fecha negócio e gera fatura

- **Sub-módulo**: Deal
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Integração payments ok
- **Passos**:
  1. Mudar para won
- **Resultado esperado**: Opcional: gera quote/invoice conforme regra

### QA-PIPE-025 — Lost exige motivo

- **Sub-módulo**: Deal
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Config motivos obrigatórios
- **Passos**:
  1. Mover para lost sem motivo
- **Resultado esperado**: Bloqueia até preencher reason

## 4. Tarefas, Atividades & Filas

### QA-TASK-001 — Criar tarefa

- **Sub-módulo**: Tarefa
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Usuário logado
- **Passos**:
  1. /tasks > Nova
  2. Título, vencimento, vínculo a deal
  3. Salvar
- **Resultado esperado**: Tarefa visível na lista e na timeline da entidade

### QA-TASK-002 — Concluir tarefa

- **Sub-módulo**: Tarefa
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Tarefa aberta
- **Passos**:
  1. Marcar checkbox 'Concluir'
- **Resultado esperado**: Status atualizado, completed_at gravado

### QA-TASK-003 — Editar tarefa

- **Sub-módulo**: Tarefa
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Tarefa existente
- **Passos**:
  1. Editar título e vencimento
  2. Salvar
- **Resultado esperado**: Alterações persistem; histórico atualizado

### QA-TASK-004 — Filtrar por minhas tarefas

- **Sub-módulo**: Tarefa
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Várias tarefas
- **Passos**:
  1. Filtro 'Minhas'
- **Resultado esperado**: Mostra apenas tarefas do usuário logado

### QA-TASK-005 — Lembrete por push/notificação

- **Sub-módulo**: Tarefa
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Push habilitado
- **Passos**:
  1. Criar tarefa para 5 min à frente
- **Resultado esperado**: Notificação disparada no horário

### QA-TASK-006 — Criar task queue

- **Sub-módulo**: Fila
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Settings > Task Queues > Nova
- **Resultado esperado**: Fila criada; vinculável a usuários

### QA-TASK-007 — Adicionar itens à fila

- **Sub-módulo**: Fila
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Fila existente
- **Passos**:
  1. Selecionar leads
  2. Adicionar à fila
- **Resultado esperado**: Itens aparecem ordenados; contador atualiza

### QA-TASK-008 — Play mode

- **Sub-módulo**: Fila
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Fila com itens
- **Passos**:
  1. Abrir fila
  2. Clicar Iniciar
- **Resultado esperado**: Ir item por item; ações log Skip/Done/Next

### QA-TASK-009 — Registrar atividade de chamada

- **Sub-módulo**: Atividade
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Contato
- **Passos**:
  1. Timeline > Nova atividade > Chamada
  2. Preencher
- **Resultado esperado**: Atividade gravada em activities; aparece na timeline

### QA-TASK-010 — Registrar e-mail enviado manualmente

- **Sub-módulo**: Atividade
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Contato
- **Passos**:
  1. Timeline > Nova > E-mail
  2. Salvar
- **Resultado esperado**: Atividade visível; vincula a email_messages se aplicável

### QA-TASK-011 — Tarefa recorrente

- **Sub-módulo**: Tarefa
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Criar com recorrência semanal
- **Resultado esperado**: Próxima instância gerada após conclusão

### QA-TASK-012 — Vincular várias entidades

- **Sub-módulo**: Tarefa
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Lead+Deal
- **Passos**:
  1. Criar tarefa com 2 vínculos
- **Resultado esperado**: Aparece em ambas timelines

### QA-TASK-013 — Bloqueio sem permissão

- **Sub-módulo**: Tarefa
- **Prioridade**: P1 | **Tipo**: Permissão | **Smoke**: —
- **Pré-condições**: Viewer
- **Passos**:
  1. Tentar criar
- **Resultado esperado**: Bloqueado

### QA-TASK-014 — Reatribuir

- **Sub-módulo**: Tarefa
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Outro user
- **Passos**:
  1. Editar tarefa
  2. Mudar responsável
- **Resultado esperado**: Notificação para novo responsável

### QA-TASK-015 — Ordenar por vencimento

- **Sub-módulo**: Tarefa
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Header 'Vence em'
- **Resultado esperado**: Ordenação asc/desc consistente

### QA-TASK-016 — Tarefa vencida destacada

- **Sub-módulo**: Tarefa
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: Vencimento < hoje
- **Passos**:
  1. Listar
- **Resultado esperado**: Linha em destaque/visual de atraso

### QA-TASK-017 — Filtro por tipo na timeline

- **Sub-módulo**: Atividade
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: Várias atividades
- **Passos**:
  1. Filtrar por 'E-mail'
- **Resultado esperado**: Somente e-mails listados

### QA-TASK-018 — Excluir fila vazia

- **Sub-módulo**: Fila
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Excluir fila
- **Resultado esperado**: Removida; itens órfãos tratados

### QA-TASK-019 — Reordenar itens

- **Sub-módulo**: Fila
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Fila com itens
- **Passos**:
  1. Drag & drop
- **Resultado esperado**: Persistência da ordem

### QA-TASK-020 — Exportar timeline

- **Sub-módulo**: Atividade
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Contato
- **Passos**:
  1. Menu > Exportar
- **Resultado esperado**: CSV/PDF gerado

## 5. Inbox Unificada

### QA-INBOX-001 — Abrir Inbox de Email

- **Sub-módulo**: Email
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Conta Email conectada
- **Passos**:
  1. Acessar /inbox/email
- **Resultado esperado**: Lista de conversas carrega; conversa selecionada mostra mensagens

### QA-INBOX-002 — Enviar mensagem em Email

- **Sub-módulo**: Email
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Conversa aberta
- **Passos**:
  1. Digitar mensagem
  2. Enviar
- **Resultado esperado**: Mensagem aparece otimisticamente; status 'enviado' após confirmação

### QA-INBOX-003 — Anexo em Email

- **Sub-módulo**: Email
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Conversa aberta
- **Passos**:
  1. Anexar arquivo PDF <5MB
  2. Enviar
- **Resultado esperado**: Anexo enviado; preview disponível; suportado pelo canal

### QA-INBOX-004 — Anexo acima do limite em Email

- **Sub-módulo**: Email
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Tentar anexo >25MB
- **Resultado esperado**: Bloqueado com mensagem clara

### QA-INBOX-005 — Marcar conversa como lida em Email

- **Sub-módulo**: Email
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Conversa não lida
- **Passos**:
  1. Abrir conversa
- **Resultado esperado**: Contador zera; estado persistido após refresh

### QA-INBOX-006 — Realtime de novas mensagens em Email

- **Sub-módulo**: Email
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: 2 abas
- **Passos**:
  1. Em outra aba, enviar mensagem
- **Resultado esperado**: Mensagem aparece sem refresh; sino notifica

### QA-INBOX-007 — Busca por texto em Email

- **Sub-módulo**: Email
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Mensagens existentes
- **Passos**:
  1. Pesquisar termo
- **Resultado esperado**: Resultados filtram conversas com highlight

### QA-INBOX-008 — Atribuir conversa em Email

- **Sub-módulo**: Email
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Atribuir a outro agente
- **Resultado esperado**: Conversa some da fila pessoal, aparece para novo agente

### QA-INBOX-009 — Encaminhar mensagem em Email

- **Sub-módulo**: Email
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Mensagem existente
- **Passos**:
  1. Menu > Encaminhar
  2. Escolher destino
- **Resultado esperado**: Encaminhamento realizado; histórico mantido

### QA-INBOX-010 — Notas internas em Email

- **Sub-módulo**: Email
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Conversa aberta
- **Passos**:
  1. Toggle 'Nota interna'
  2. Digitar
  3. Postar
- **Resultado esperado**: Nota visível apenas internamente; mensagens externas não recebem

### QA-INBOX-011 — Abrir Inbox de WhatsApp

- **Sub-módulo**: WhatsApp
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Conta WhatsApp conectada
- **Passos**:
  1. Acessar /inbox/whatsapp
- **Resultado esperado**: Lista de conversas carrega; conversa selecionada mostra mensagens

### QA-INBOX-012 — Enviar mensagem em WhatsApp

- **Sub-módulo**: WhatsApp
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Conversa aberta
- **Passos**:
  1. Digitar mensagem
  2. Enviar
- **Resultado esperado**: Mensagem aparece otimisticamente; status 'enviado' após confirmação

### QA-INBOX-013 — Anexo em WhatsApp

- **Sub-módulo**: WhatsApp
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Conversa aberta
- **Passos**:
  1. Anexar arquivo PDF <5MB
  2. Enviar
- **Resultado esperado**: Anexo enviado; preview disponível; suportado pelo canal

### QA-INBOX-014 — Anexo acima do limite em WhatsApp

- **Sub-módulo**: WhatsApp
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Tentar anexo >25MB
- **Resultado esperado**: Bloqueado com mensagem clara

### QA-INBOX-015 — Marcar conversa como lida em WhatsApp

- **Sub-módulo**: WhatsApp
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Conversa não lida
- **Passos**:
  1. Abrir conversa
- **Resultado esperado**: Contador zera; estado persistido após refresh

### QA-INBOX-016 — Realtime de novas mensagens em WhatsApp

- **Sub-módulo**: WhatsApp
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: 2 abas
- **Passos**:
  1. Em outra aba, enviar mensagem
- **Resultado esperado**: Mensagem aparece sem refresh; sino notifica

### QA-INBOX-017 — Busca por texto em WhatsApp

- **Sub-módulo**: WhatsApp
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Mensagens existentes
- **Passos**:
  1. Pesquisar termo
- **Resultado esperado**: Resultados filtram conversas com highlight

### QA-INBOX-018 — Atribuir conversa em WhatsApp

- **Sub-módulo**: WhatsApp
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Atribuir a outro agente
- **Resultado esperado**: Conversa some da fila pessoal, aparece para novo agente

### QA-INBOX-019 — Encaminhar mensagem em WhatsApp

- **Sub-módulo**: WhatsApp
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Mensagem existente
- **Passos**:
  1. Menu > Encaminhar
  2. Escolher destino
- **Resultado esperado**: Encaminhamento realizado; histórico mantido

### QA-INBOX-020 — Notas internas em WhatsApp

- **Sub-módulo**: WhatsApp
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Conversa aberta
- **Passos**:
  1. Toggle 'Nota interna'
  2. Digitar
  3. Postar
- **Resultado esperado**: Nota visível apenas internamente; mensagens externas não recebem

### QA-INBOX-021 — Abrir Inbox de Chat

- **Sub-módulo**: Chat
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Conta Chat conectada
- **Passos**:
  1. Acessar /inbox/chat
- **Resultado esperado**: Lista de conversas carrega; conversa selecionada mostra mensagens

### QA-INBOX-022 — Enviar mensagem em Chat

- **Sub-módulo**: Chat
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Conversa aberta
- **Passos**:
  1. Digitar mensagem
  2. Enviar
- **Resultado esperado**: Mensagem aparece otimisticamente; status 'enviado' após confirmação

### QA-INBOX-023 — Anexo em Chat

- **Sub-módulo**: Chat
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Conversa aberta
- **Passos**:
  1. Anexar arquivo PDF <5MB
  2. Enviar
- **Resultado esperado**: Anexo enviado; preview disponível; suportado pelo canal

### QA-INBOX-024 — Anexo acima do limite em Chat

- **Sub-módulo**: Chat
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Tentar anexo >25MB
- **Resultado esperado**: Bloqueado com mensagem clara

### QA-INBOX-025 — Marcar conversa como lida em Chat

- **Sub-módulo**: Chat
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Conversa não lida
- **Passos**:
  1. Abrir conversa
- **Resultado esperado**: Contador zera; estado persistido após refresh

### QA-INBOX-026 — Realtime de novas mensagens em Chat

- **Sub-módulo**: Chat
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: 2 abas
- **Passos**:
  1. Em outra aba, enviar mensagem
- **Resultado esperado**: Mensagem aparece sem refresh; sino notifica

### QA-INBOX-027 — Busca por texto em Chat

- **Sub-módulo**: Chat
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Mensagens existentes
- **Passos**:
  1. Pesquisar termo
- **Resultado esperado**: Resultados filtram conversas com highlight

### QA-INBOX-028 — Atribuir conversa em Chat

- **Sub-módulo**: Chat
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Atribuir a outro agente
- **Resultado esperado**: Conversa some da fila pessoal, aparece para novo agente

### QA-INBOX-029 — Encaminhar mensagem em Chat

- **Sub-módulo**: Chat
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Mensagem existente
- **Passos**:
  1. Menu > Encaminhar
  2. Escolher destino
- **Resultado esperado**: Encaminhamento realizado; histórico mantido

### QA-INBOX-030 — Notas internas em Chat

- **Sub-módulo**: Chat
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Conversa aberta
- **Passos**:
  1. Toggle 'Nota interna'
  2. Digitar
  3. Postar
- **Resultado esperado**: Nota visível apenas internamente; mensagens externas não recebem

## 6. Campanhas (Email/WhatsApp/Prospecting)

### QA-CAMP-001 — Criar email broadcast

- **Sub-módulo**: Email
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Plano com permissão
- **Passos**:
  1. /campaigns/email > Novo
  2. Nome, segmento, template
  3. Agendar
- **Resultado esperado**: Broadcast criado em status scheduled

### QA-CAMP-002 — Pausar broadcast em execução

- **Sub-módulo**: Email
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Broadcast running
- **Passos**:
  1. Clicar Pausar
- **Resultado esperado**: Status muda para paused; envios cessam

### QA-CAMP-003 — Cancelar broadcast

- **Sub-módulo**: Email
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Scheduled
- **Passos**:
  1. Cancelar
- **Resultado esperado**: Status canceled; recipients não enviados ficam com status skipped

### QA-CAMP-004 — Métricas open/click

- **Sub-módulo**: Email
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Broadcast enviado
- **Passos**:
  1. Abrir detalhes
- **Resultado esperado**: Open rate, click rate e bounces exibidos com base em email_tracking_events

### QA-CAMP-005 — Unsubscribe via link

- **Sub-módulo**: Email
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: E-mail enviado
- **Passos**:
  1. Clicar 'descadastrar' no e-mail
- **Resultado esperado**: Token validado; contato em email_unsubscribes; futuros envios bloqueados

### QA-CAMP-006 — Supressão respeitada

- **Sub-módulo**: Email
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Contato em suppressed_emails
- **Passos**:
  1. Disparar broadcast incluindo contato
- **Resultado esperado**: Contato não recebe; recipient marcado suppressed

### QA-CAMP-007 — Pré-visualização e teste

- **Sub-módulo**: Email
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Broadcast em rascunho
- **Passos**:
  1. Botão 'Enviar teste'
  2. Informar e-mail
- **Resultado esperado**: E-mail de teste recebido com merge fields renderizados

### QA-CAMP-008 — Merge fields inválidos

- **Sub-módulo**: Email
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: Template com {{x}} inexistente
- **Passos**:
  1. Tentar salvar
- **Resultado esperado**: Aviso de variável desconhecida

### QA-CAMP-009 — Listar campanhas WhatsApp

- **Sub-módulo**: WhatsApp
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Plano Prata+
- **Passos**:
  1. Acessar /campaigns/whatsapp
- **Resultado esperado**: Tabela carrega; ações Editar/Excluir/Iniciar

### QA-CAMP-010 — Criar campanha WhatsApp

- **Sub-módulo**: WhatsApp
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Plano Prata+, template aprovado
- **Passos**:
  1. Novo
  2. Selecionar template e segmento
  3. Salvar
- **Resultado esperado**: Campanha criada em draft

### QA-CAMP-011 — Editar campanha WhatsApp em draft

- **Sub-módulo**: WhatsApp
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Campanha draft
- **Passos**:
  1. Editar nome/template/segmento
  2. Salvar
- **Resultado esperado**: Persistência das alterações; histórico/updated_at atualizado

### QA-CAMP-012 — Bloquear edição de campanha em execução

- **Sub-módulo**: WhatsApp
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: status=running
- **Passos**:
  1. Tentar editar
- **Resultado esperado**: Botão Editar desabilitado/erro de validação

### QA-CAMP-013 — Iniciar envio

- **Sub-módulo**: WhatsApp
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Campanha pronta
- **Passos**:
  1. Botão Iniciar
- **Resultado esperado**: Status running; mensagens enfileiradas; cron whatsapp-campaign-tick processa

### QA-CAMP-014 — Mídia em template

- **Sub-módulo**: WhatsApp
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Template com header media
- **Passos**:
  1. Anexar imagem
  2. Salvar
- **Resultado esperado**: Validação de tipo/tamanho; upload em storage

### QA-CAMP-015 — Erro de template não aprovado

- **Sub-módulo**: WhatsApp
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Template em REJECTED
- **Passos**:
  1. Tentar usar
- **Resultado esperado**: Bloqueado com mensagem clara

### QA-CAMP-016 — Métricas de entrega

- **Sub-módulo**: WhatsApp
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Campanha enviada
- **Passos**:
  1. Abrir detalhes
- **Resultado esperado**: Contadores sent/delivered/read/failed atualizados via webhook Meta

### QA-CAMP-017 — Criar prospecting campaign

- **Sub-módulo**: Prospecting
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Plano Prata+
- **Passos**:
  1. /prospecting > Nova
  2. Lista, script, variantes
- **Resultado esperado**: Campanha criada; variants vinculadas

### QA-CAMP-018 — A/B variants

- **Sub-módulo**: Prospecting
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: 2 variantes
- **Passos**:
  1. Iniciar
- **Resultado esperado**: Distribuição 50/50 (ou config); eventos ab_test_events gravados

### QA-CAMP-019 — Dial outbound

- **Sub-módulo**: Prospecting
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Twilio conectado
- **Passos**:
  1. Botão Dial
- **Resultado esperado**: Chamada iniciada; prospecting_call_attempts log

### QA-CAMP-020 — Resultado da chamada

- **Sub-módulo**: Prospecting
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Pós-dial
- **Passos**:
  1. Selecionar resultado (conectado/no-answer)
- **Resultado esperado**: prospecting_results persistido; agendamento de retry conforme regra

### QA-CAMP-021 — Bounce hard registra supressão

- **Sub-módulo**: Email
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Bounce recebido
- **Passos**:
  1. Simular webhook bounce
- **Resultado esperado**: Contato vai a suppressed_emails

### QA-CAMP-022 — Throttling de envio

- **Sub-módulo**: Email
- **Prioridade**: P2 | **Tipo**: Performance | **Smoke**: —
- **Pré-condições**: Quota Twilio/SES
- **Passos**:
  1. Disparo grande
- **Resultado esperado**: Sistema respeita rate limit; sem perda de mensagens

### QA-CAMP-023 — Botão Excluir campanha

- **Sub-módulo**: WhatsApp
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: draft
- **Passos**:
  1. Excluir
- **Resultado esperado**: Removida; recipients/atalhos limpos

### QA-CAMP-024 — Agendamento futuro respeita timezone

- **Sub-módulo**: Email
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: TZ definido
- **Passos**:
  1. Agendar para 18h America/Sao_Paulo
- **Resultado esperado**: cron dispara em UTC equivalente correto

### QA-CAMP-025 — Script dinâmico com variáveis

- **Sub-módulo**: Prospecting
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Script com vars
- **Passos**:
  1. Iniciar dial
- **Resultado esperado**: Variáveis renderizadas com dados do lead

### QA-CAMP-026 — Segmento dinâmico atualizado

- **Sub-módulo**: Email
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Segmento por tag
- **Passos**:
  1. Disparar broadcast
- **Resultado esperado**: Recipients refletem segmento no instante do envio

### QA-CAMP-027 — Encerrar campanha manualmente

- **Sub-módulo**: WhatsApp
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: running
- **Passos**:
  1. Pausar/Encerrar
- **Resultado esperado**: Status alterado; pendentes não enviados

### QA-CAMP-028 — Tracking pixel /api/public/email/pixel

- **Sub-módulo**: Email
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: E-mail enviado
- **Passos**:
  1. Abrir e-mail
- **Resultado esperado**: Hit registra evento open em email_tracking_events

### QA-CAMP-029 — Tracking de click /api/public/email/click

- **Sub-módulo**: Email
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Link no e-mail
- **Passos**:
  1. Clicar
- **Resultado esperado**: Redireciona para destino e registra click

### QA-CAMP-030 — Encerrar dial automaticamente após N tentativas

- **Sub-módulo**: Prospecting
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Política configurada
- **Passos**:
  1. Executar dials repetidos
- **Resultado esperado**: Após N falhas, lead marcado como exhausted

## 7. Comunicação & Telefonia (Twilio/WhatsApp/Vapi)

### QA-COMM-001 — Click-to-call

- **Sub-módulo**: Voice
- **Prioridade**: P0 | **Tipo**: Integração | **Smoke**: ✅
- **Pré-condições**: Twilio conectado
- **Passos**:
  1. Abrir contato
  2. Clicar telefone
- **Resultado esperado**: Chamada inicia via Twilio; status realtime

### QA-COMM-002 — Gravação da chamada

- **Sub-módulo**: Voice
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Recording habilitado
- **Passos**:
  1. Concluir chamada
- **Resultado esperado**: URL de gravação salva; player no histórico

### QA-COMM-003 — Transcrição da chamada

- **Sub-módulo**: Voice
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Provedor ASR
- **Passos**:
  1. Pós-chamada
- **Resultado esperado**: Transcrição salva em activities; busca por texto funciona

### QA-COMM-004 — Status callback Twilio

- **Sub-módulo**: Voice
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Webhook /api/public/twilio/voice-status
- **Passos**:
  1. Twilio envia status
- **Resultado esperado**: Assinatura X-Twilio-Signature validada; status atualizado

### QA-COMM-005 — Assinatura Twilio inválida

- **Sub-módulo**: Voice
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. POST sem assinatura ou inválida
- **Resultado esperado**: 401; nenhum dado alterado

### QA-COMM-006 — Envio WhatsApp

- **Sub-módulo**: WA
- **Prioridade**: P0 | **Tipo**: Integração | **Smoke**: ✅
- **Pré-condições**: Conta WA conectada
- **Passos**:
  1. Conversa
  2. Enviar texto
- **Resultado esperado**: Mensagem aparece com 'enviado'

### QA-COMM-007 — Recebimento via webhook Meta

- **Sub-módulo**: WA
- **Prioridade**: P0 | **Tipo**: Integração | **Smoke**: ✅
- **Pré-condições**: Webhook configurado
- **Passos**:
  1. Meta envia POST /api/public/whatsapp/webhook
- **Resultado esperado**: Verify token validado; mensagem persistida

### QA-COMM-008 — Mídia recebida

- **Sub-módulo**: WA
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Imagem enviada por usuário
- **Passos**:
  1. Receber payload com media id
- **Resultado esperado**: Download para storage; preview no chat

### QA-COMM-009 — Status delivered/read

- **Sub-módulo**: WA
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Status webhook
- **Passos**:
  1. Receber callback
- **Resultado esperado**: whatsapp_messages atualizado; UI mostra checks

### QA-COMM-010 — Template fora da janela 24h

- **Sub-módulo**: WA
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Conversa expirada
- **Passos**:
  1. Enviar texto livre
- **Resultado esperado**: Bloqueado; sugere template

### QA-COMM-011 — Voice Agent (Vapi)

- **Sub-módulo**: VoiceAgent
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Conector Vapi configurado
- **Passos**:
  1. Settings > Voice Agent
  2. Iniciar simulação
- **Resultado esperado**: Agente responde; transcrição salva

### QA-COMM-012 — Discagem internacional

- **Sub-módulo**: Voice
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Número E.164
- **Passos**:
  1. Discar número +44...
- **Resultado esperado**: Twilio aceita conforme plano; sem 'invalid number'

### QA-COMM-013 — Falha de saldo Twilio

- **Sub-módulo**: Voice
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Saldo insuficiente
- **Passos**:
  1. Discar
- **Resultado esperado**: Mensagem clara; sem loop

### QA-COMM-014 — Mute/unmute na chamada

- **Sub-módulo**: Voice
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Chamada ativa
- **Passos**:
  1. Mute
  2. Unmute
- **Resultado esperado**: Estado refletido; outro lado não escuta enquanto mute

### QA-COMM-015 — Resposta a mensagem com quote

- **Sub-módulo**: WA
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Mensagem existente
- **Passos**:
  1. Reply on message
- **Resultado esperado**: Quote correto preservado

### QA-COMM-016 — Histórico de chamadas no contato

- **Sub-módulo**: Voice
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Várias chamadas
- **Passos**:
  1. Aba 'Chamadas'
- **Resultado esperado**: Lista paginada; reprodução de gravação

### QA-COMM-017 — DNC (Do Not Call) respeitado

- **Sub-módulo**: Voice
- **Prioridade**: P1 | **Tipo**: Compliance | **Smoke**: —
- **Pré-condições**: Contato com DNC
- **Passos**:
  1. Tentar discar
- **Resultado esperado**: Bloqueado

### QA-COMM-018 — Opt-out por palavra-chave

- **Sub-módulo**: WA
- **Prioridade**: P1 | **Tipo**: Compliance | **Smoke**: —
- **Pré-condições**: Palavra 'PARAR'
- **Passos**:
  1. Receber 'PARAR'
- **Resultado esperado**: Contato marcado opt-out; envios futuros bloqueados

### QA-COMM-019 — Conferência 3-way

- **Sub-módulo**: Voice
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Chamada ativa
- **Passos**:
  1. Adicionar terceiro
- **Resultado esperado**: Conferência criada

### QA-COMM-020 — Logs em supabase edge function

- **Sub-módulo**: Voice
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Inspecionar logs
- **Resultado esperado**: Sem PII em logs; apenas IDs

## 8. Reuniões / Calendário / Booking

### QA-MEET-001 — Conectar Google Calendar

- **Sub-módulo**: Calendar
- **Prioridade**: P0 | **Tipo**: Integração | **Smoke**: ✅
- **Pré-condições**: Conector Google
- **Passos**:
  1. Settings > Calendars > Conectar Google
  2. Autorizar
- **Resultado esperado**: calendar_accounts criado; sync inicial concluído

### QA-MEET-002 — Sync incremental via cron

- **Sub-módulo**: Calendar
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Conta conectada
- **Passos**:
  1. Aguardar tick /api/public/cron/calendar-tick
- **Resultado esperado**: Eventos novos/atualizados refletidos em calendar_events

### QA-MEET-003 — Desconectar conta

- **Sub-módulo**: Calendar
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Conta conectada
- **Passos**:
  1. Desconectar
- **Resultado esperado**: Eventos congelam; tokens revogados

### QA-MEET-004 — Criar booking page

- **Sub-módulo**: Booking
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Admin
- **Passos**:
  1. Settings > Booking > Nova
  2. Slug, duração, calendário
- **Resultado esperado**: Página pública /book/$slug acessível

### QA-MEET-005 — Booking público

- **Sub-módulo**: Booking
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Página ativa
- **Passos**:
  1. Abrir /book/$slug em incógnito
  2. Selecionar slot
  3. Submeter
- **Resultado esperado**: Booking criado; evento adicionado ao calendário; e-mail confirma

### QA-MEET-006 — Slug inexistente

- **Sub-módulo**: Booking
- **Prioridade**: P1 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. /book/xxx
- **Resultado esperado**: 404 amigável

### QA-MEET-007 — Buffer e disponibilidade

- **Sub-módulo**: Booking
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Buffer 15min
- **Passos**:
  1. Selecionar slot
- **Resultado esperado**: Slot anterior/posterior respeitam buffer

### QA-MEET-008 — Fuso horário do convidado

- **Sub-módulo**: Booking
- **Prioridade**: P2 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: TZ diferente
- **Passos**:
  1. Convidado em America/New_York
- **Resultado esperado**: Horários convertidos no UI público

### QA-MEET-009 — Cancelar booking

- **Sub-módulo**: Booking
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Booking ativo
- **Passos**:
  1. Link de cancelamento no e-mail
- **Resultado esperado**: Booking cancelado; slot liberado; calendar atualizado

### QA-MEET-010 — Reagendar

- **Sub-módulo**: Booking
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Booking ativo
- **Passos**:
  1. Link reagendar
- **Resultado esperado**: Novo slot escolhido; evento original removido

### QA-MEET-011 — Página /meet/$token

- **Sub-módulo**: Meeting
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Token válido
- **Passos**:
  1. Abrir link
- **Resultado esperado**: Sala carrega (Daily/Whereby) ou iframe correto

### QA-MEET-012 — Token inválido

- **Sub-módulo**: Meeting
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. /meet/xxx
- **Resultado esperado**: Erro 404

### QA-MEET-013 — Gravação salva

- **Sub-módulo**: Meeting
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Gravação habilitada
- **Passos**:
  1. Finalizar reunião
- **Resultado esperado**: URL salva em meetings; processada por cron calendar-recordings-tick

### QA-MEET-014 — Resumo IA

- **Sub-módulo**: Meeting
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: ai-summary cron
- **Passos**:
  1. Pós-gravação
- **Resultado esperado**: Resumo aparece em meeting_summaries

### QA-MEET-015 — Conflito de evento

- **Sub-módulo**: Calendar
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Eventos sobrepostos
- **Passos**:
  1. Criar booking sobre evento
- **Resultado esperado**: Slot indisponível

### QA-MEET-016 — Editar evento no CRM

- **Sub-módulo**: Calendar
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Evento existente
- **Passos**:
  1. Editar título
- **Resultado esperado**: Atualizado no Google via API

### QA-MEET-017 — Anti-spam em booking

- **Sub-módulo**: Booking
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Múltiplos submits
- **Passos**:
  1. Submeter 5x em 1min
- **Resultado esperado**: Throttle por IP

### QA-MEET-018 — Campos custom no booking

- **Sub-módulo**: Booking
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: Custom field obrigatório
- **Passos**:
  1. Submeter sem preencher
- **Resultado esperado**: Erro de validação

### QA-MEET-019 — Token Google expirado

- **Sub-módulo**: Calendar
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Refresh
- **Passos**:
  1. Forçar 401
- **Resultado esperado**: Refresh automático; sem falha visível

### QA-MEET-020 — Booking aceita anexo opcional

- **Sub-módulo**: Booking
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Form com upload
- **Passos**:
  1. Anexar PDF
- **Resultado esperado**: Upload em storage; link no e-mail

### QA-MEET-021 — Participantes registrados

- **Sub-módulo**: Meeting
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Reunião com 3
- **Passos**:
  1. Verificar meeting_participants
- **Resultado esperado**: Registros corretos com e-mail e status

### QA-MEET-022 — Sync respeita múltiplos calendários

- **Sub-módulo**: Calendar
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: 2 contas
- **Passos**:
  1. Conectar 2
- **Resultado esperado**: Eventos de ambas listados sem duplicação

### QA-MEET-023 — Limite de bookings/dia

- **Sub-módulo**: Booking
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Cap configurado
- **Passos**:
  1. Tentar exceder
- **Resultado esperado**: Slots bloqueados após cap

### QA-MEET-024 — i18n na página pública

- **Sub-módulo**: Booking
- **Prioridade**: P3 | **Tipo**: Acessibilidade | **Smoke**: —
- **Pré-condições**: TZ + idioma
- **Passos**:
  1. Abrir com locale pt-BR
- **Resultado esperado**: Conteúdo traduzido

### QA-MEET-025 — RLS de eventos

- **Sub-módulo**: Calendar
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Outro workspace
- **Passos**:
  1. Tentar GET evento alheio
- **Resultado esperado**: Negado

## 9. Marketing & Captação (Forms/LP/Survey/Widget/Ads)

### QA-MKT-001 — Criar form

- **Sub-módulo**: Forms
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Admin
- **Passos**:
  1. Settings > Forms > Novo
  2. Adicionar campos
  3. Salvar
- **Resultado esperado**: Form publicado; embed JS disponível

### QA-MKT-002 — Submit público

- **Sub-módulo**: Forms
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: /api/public/forms/$slug
- **Passos**:
  1. Preencher e submeter via embed
- **Resultado esperado**: Submission persistida; lead/contato criado conforme mapping

### QA-MKT-003 — Anti-spam honeypot

- **Sub-módulo**: Forms
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Bot preenche campo oculto
- **Passos**:
  1. Submit com campo honeypot
- **Resultado esperado**: Submission descartada silenciosamente

### QA-MKT-004 — reCAPTCHA / rate limit

- **Sub-módulo**: Forms
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Bursts
- **Passos**:
  1. Submeter 20x do mesmo IP
- **Resultado esperado**: Bloqueio com 429

### QA-MKT-005 — Validação client/server

- **Sub-módulo**: Forms
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Campo obrigatório
- **Passos**:
  1. Submeter vazio via curl
- **Resultado esperado**: 400 com mensagem clara

### QA-MKT-006 — Embed script

- **Sub-módulo**: Forms
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: Página externa
- **Passos**:
  1. Carregar script do form
- **Resultado esperado**: Render correto; sem console errors

### QA-MKT-007 — Criar landing page

- **Sub-módulo**: LP
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Builder LP
  2. Hero+CTA
  3. Publicar
- **Resultado esperado**: URL pública acessível; landing_page_events registrados

### QA-MKT-008 — Tracking de page view

- **Sub-módulo**: LP
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: LP publicada
- **Passos**:
  1. Abrir LP
- **Resultado esperado**: Evento page_view persistido

### QA-MKT-009 — Criar survey

- **Sub-módulo**: Survey
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Settings > Surveys > Nova
- **Resultado esperado**: Survey ativo com token

### QA-MKT-010 — Responder survey público

- **Sub-módulo**: Survey
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: /survey/$token
- **Passos**:
  1. Abrir link
  2. Responder
- **Resultado esperado**: survey_responses persistido

### QA-MKT-011 — Survey expirada

- **Sub-módulo**: Survey
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: expires_at vencida
- **Passos**:
  1. Abrir link
- **Resultado esperado**: Mensagem 'expirada'

### QA-MKT-012 — Widget chat público

- **Sub-módulo**: Widget
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: /widget/script.js
- **Passos**:
  1. Embutir em site
  2. Iniciar chat
- **Resultado esperado**: live_chat_sessions cria; mensagens em live_chat_messages

### QA-MKT-013 — Mensagens em tempo real

- **Sub-módulo**: Widget
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: 2 abas
- **Passos**:
  1. Operador responde no inbox
- **Resultado esperado**: Visitante vê resposta sem refresh

### QA-MKT-014 — Anti-XSS no widget

- **Sub-módulo**: Widget
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Texto com <script>
- **Passos**:
  1. Enviar pelo visitante
- **Resultado esperado**: Sanitização; sem execução

### QA-MKT-015 — WhatsApp Ads referral

- **Sub-módulo**: Ads
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Click Meta Ads → WhatsApp
- **Passos**:
  1. Receber payload wa_ad_referrals
- **Resultado esperado**: Atribuição associada ao contato/lead

### QA-MKT-016 — Sync de Ads accounts

- **Sub-módulo**: Ads
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Conector Ads
- **Passos**:
  1. Settings > Ads Sync
- **Resultado esperado**: Contas listadas; audiences/forms importados

### QA-MKT-017 — Mapping para campos custom

- **Sub-módulo**: Forms
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Property custom
- **Passos**:
  1. Mapear campo do form para custom property
- **Resultado esperado**: Submit grava valor no contato

### QA-MKT-018 — CORS do embed

- **Sub-módulo**: Forms
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Site externo
- **Passos**:
  1. Submit via fetch
- **Resultado esperado**: Headers CORS adequados; sem block

### QA-MKT-019 — SEO da LP

- **Sub-módulo**: LP
- **Prioridade**: P2 | **Tipo**: SEO | **Smoke**: —
- **Pré-condições**: Title/desc/OG
- **Passos**:
  1. View source
- **Resultado esperado**: Tags presentes e únicas

### QA-MKT-020 — Robots/sitemap

- **Sub-módulo**: LP
- **Prioridade**: P2 | **Tipo**: SEO | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. /sitemap.xml
  2. /robots.txt
- **Resultado esperado**: URLs públicas listadas; rotas privadas excluídas

### QA-MKT-021 — Notificação ao submit

- **Sub-módulo**: Forms
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Webhook config
- **Passos**:
  1. Submeter
- **Resultado esperado**: Outbound webhook disparado conforme config

### QA-MKT-022 — Form privado/oculto

- **Sub-módulo**: Forms
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Toggle inativo
- **Passos**:
  1. Abrir /api/public/forms/$slug
- **Resultado esperado**: 404; submit bloqueado

### QA-MKT-023 — CSAT atrelado a ticket

- **Sub-módulo**: Survey
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Ticket fechado
- **Passos**:
  1. Receber survey por e-mail
- **Resultado esperado**: Resposta vincula ao ticket; média atualiza

### QA-MKT-024 — Pré-prompt e branding

- **Sub-módulo**: Widget
- **Prioridade**: P3 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: Branding config
- **Passos**:
  1. Carregar widget
- **Resultado esperado**: Logo/cores do workspace aplicadas

### QA-MKT-025 — A/B test em LP

- **Sub-módulo**: LP
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: 2 variantes
- **Passos**:
  1. 50/50
- **Resultado esperado**: ab_test_events registrados; conversões corretas

## 10. Vendas Avançadas (Quotes/E-sign/Payments/NFSe)

### QA-SALES-001 — Criar quote a partir do deal

- **Sub-módulo**: Quote
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Deal com produtos
- **Passos**:
  1. Deal > Gerar quote
- **Resultado esperado**: Quote em draft com line items

### QA-SALES-002 — Enviar quote por e-mail

- **Sub-módulo**: Quote
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Quote draft
- **Passos**:
  1. Enviar
- **Resultado esperado**: E-mail com link /quote/$token; status sent

### QA-SALES-003 — Aceite público

- **Sub-módulo**: Quote
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: /quote/$token
- **Passos**:
  1. Abrir link
  2. Aceitar
- **Resultado esperado**: Status accepted; proposal_approvals log

### QA-SALES-004 — Recusar quote

- **Sub-módulo**: Quote
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Quote ativo
- **Passos**:
  1. Recusar com motivo
- **Resultado esperado**: Status declined com reason

### QA-SALES-005 — Templates de quote

- **Sub-módulo**: Quote
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Templates cadastrados
- **Passos**:
  1. Criar quote a partir de template
- **Resultado esperado**: Conteúdo pré-preenchido

### QA-SALES-006 — Cláusulas reutilizáveis

- **Sub-módulo**: Proposal
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Cláusulas
- **Passos**:
  1. Adicionar cláusula ao quote
- **Resultado esperado**: Inserção correta; ordenação editável

### QA-SALES-007 — Criar documento e-sign

- **Sub-módulo**: ESign
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Quote/contrato
- **Passos**:
  1. Iniciar assinatura
  2. Adicionar signers
- **Resultado esperado**: Esign_documents/signers criados

### QA-SALES-008 — Assinar publicamente

- **Sub-módulo**: ESign
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: /sign/$token
- **Passos**:
  1. Abrir link
  2. Assinar
- **Resultado esperado**: Assinatura registrada; áudit em esign_audit

### QA-SALES-009 — Token inválido

- **Sub-módulo**: ESign
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. /sign/xxx
- **Resultado esperado**: 404

### QA-SALES-010 — Sequência de assinaturas

- **Sub-módulo**: ESign
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Ordem A→B
- **Passos**:
  1. A assina
  2. B recebe
- **Resultado esperado**: Notificação a B apenas após A

### QA-SALES-011 — PIX gerado

- **Sub-módulo**: Payments
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Stripe BR/payments enabled
- **Passos**:
  1. Quote aceito
- **Resultado esperado**: QR PIX gerado; customer_invoices criado

### QA-SALES-012 — Cartão (Stripe)

- **Sub-módulo**: Payments
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Pagar com cartão teste
- **Resultado esperado**: Pagamento aprovado; customer_payments registrado

### QA-SALES-013 — Webhook Stripe

- **Sub-módulo**: Payments
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: /api/public/payments/webhook
- **Passos**:
  1. Enviar evento test
- **Resultado esperado**: Assinatura validada; estado atualizado

### QA-SALES-014 — Webhook assinatura inválida

- **Sub-módulo**: Payments
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. Enviar sem secret
- **Resultado esperado**: 401

### QA-SALES-015 — Plano recorrente

- **Sub-módulo**: Recurring
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Plano cadastrado
- **Passos**:
  1. Atribuir a cliente
- **Resultado esperado**: Subscription/recurring_plans criado

### QA-SALES-016 — Renovação automática

- **Sub-módulo**: Recurring
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Plano ativo
- **Passos**:
  1. Aguardar próxima cobrança
- **Resultado esperado**: Nova fatura emitida via cron

### QA-SALES-017 — Política de inadimplência

- **Sub-módulo**: Dunning
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Fatura vencida
- **Passos**:
  1. Aguardar dunning-tick
- **Resultado esperado**: E-mails de cobrança disparados conforme política

### QA-SALES-018 — Emitir NFS-e

- **Sub-módulo**: NFSe
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Cliente PJ
- **Passos**:
  1. Botão Emitir NFS-e
- **Resultado esperado**: nfse_invoices criado; integração com prefeitura responde

### QA-SALES-019 — Erro de validação fiscal

- **Sub-módulo**: NFSe
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: CPF/CNPJ inválido
- **Passos**:
  1. Tentar emitir
- **Resultado esperado**: Erro claro; nada persistido

### QA-SALES-020 — Aprovação interna

- **Sub-módulo**: Quote
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Aprovador config
- **Passos**:
  1. Solicitar aprovação
- **Resultado esperado**: proposal_approvals; bloqueia envio até aprovação

### QA-SALES-021 — Versionamento

- **Sub-módulo**: Quote
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Edição pós-envio
- **Passos**:
  1. Editar quote enviado
- **Resultado esperado**: Cria nova versão; histórico preservado

### QA-SALES-022 — Reembolso parcial

- **Sub-módulo**: Payments
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Pagamento ok
- **Passos**:
  1. Refund parcial
- **Resultado esperado**: Stripe refund; ledger atualizado

### QA-SALES-023 — Cancelar assinatura

- **Sub-módulo**: Recurring
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Sub ativa
- **Passos**:
  1. Cancelar
- **Resultado esperado**: Status canceled; sem novas cobranças

### QA-SALES-024 — Customer invoices listagem

- **Sub-módulo**: Customer
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Faturas
- **Passos**:
  1. Acessar /billing
- **Resultado esperado**: Lista com status, link de PDF

### QA-SALES-025 — Customer payments listagem

- **Sub-módulo**: Customer
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Pagamentos
- **Passos**:
  1. Acessar
- **Resultado esperado**: Histórico correto; conciliação visível

## 11. Atendimento (Tickets/SLA/Macros/KB)

### QA-HELP-001 — Criar ticket

- **Sub-módulo**: Ticket
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Suporte
- **Passos**:
  1. /tickets > Novo
- **Resultado esperado**: Ticket criado; SLA inicia

### QA-HELP-002 — Atribuir e responder

- **Sub-módulo**: Ticket
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Ticket aberto
- **Passos**:
  1. Atribuir
  2. Responder
- **Resultado esperado**: Resposta registrada; status updated

### QA-HELP-003 — Fechar ticket

- **Sub-módulo**: Ticket
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Ticket aberto
- **Passos**:
  1. Fechar
- **Resultado esperado**: Status closed; survey CSAT pode disparar

### QA-HELP-004 — Reabrir

- **Sub-módulo**: Ticket
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Ticket closed
- **Passos**:
  1. Reabrir
- **Resultado esperado**: Status open; SLA recalcula

### QA-HELP-005 — Aplicar macro

- **Sub-módulo**: Macros
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Macro definida
- **Passos**:
  1. Aplicar no ticket
- **Resultado esperado**: Texto/ações aplicados

### QA-HELP-006 — Política de SLA violada

- **Sub-módulo**: SLA
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: SLA 1h
- **Passos**:
  1. Não responder em 1h
- **Resultado esperado**: Alerta gerado; status SLA breached

### QA-HELP-007 — Aplicar playbook

- **Sub-módulo**: Playbook
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Playbook config
- **Passos**:
  1. Iniciar playbook
- **Resultado esperado**: Etapas guiam atendimento; playbook_responses log

### QA-HELP-008 — Análise de sentimento

- **Sub-módulo**: Sentimento
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: sentiment cron
- **Passos**:
  1. Aguardar tick
- **Resultado esperado**: message_sentiments persistido

### QA-HELP-009 — Survey CSAT enviada

- **Sub-módulo**: CSAT
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Ticket fechado
- **Passos**:
  1. E-mail recebido
- **Resultado esperado**: Link público abre survey

### QA-HELP-010 — Listar artigos públicos

- **Sub-módulo**: KB
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: /kb
- **Passos**:
  1. Abrir /kb
- **Resultado esperado**: Categorias e artigos listados; busca funciona

### QA-HELP-011 — Artigo público com SEO

- **Sub-módulo**: KB
- **Prioridade**: P2 | **Tipo**: SEO | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. View source de /kb/$slug
- **Resultado esperado**: Title/desc/OG corretos; H1 único

### QA-HELP-012 — Bloquear ação sem permissão

- **Sub-módulo**: Ticket
- **Prioridade**: P1 | **Tipo**: Permissão | **Smoke**: —
- **Pré-condições**: Viewer
- **Passos**:
  1. Tentar responder
- **Resultado esperado**: Bloqueado

### QA-HELP-013 — Anexo em ticket

- **Sub-módulo**: Ticket
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Anexar PDF
- **Resultado esperado**: Upload em storage; link no thread

### QA-HELP-014 — Conversão de e-mail em ticket

- **Sub-módulo**: Ticket
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: E-mail inbound
- **Passos**:
  1. Receber e-mail no inbox
- **Resultado esperado**: Botão 'Criar ticket' funciona

### QA-HELP-015 — Auditoria

- **Sub-módulo**: Ticket
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Ações no ticket
- **Passos**:
  1. Ver histórico
- **Resultado esperado**: Logs de atribuição/edição/fechamento

## 12. Knowledge Base & Portal

### QA-KB-001 — Criar artigo

- **Sub-módulo**: KB
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Settings > KB > Novo
- **Resultado esperado**: Artigo salvo; visível em /kb

### QA-KB-002 — Editor rich text seguro

- **Sub-módulo**: KB
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. Inserir <script>alert(1)</script>
- **Resultado esperado**: Sanitização; sem XSS no público

### QA-KB-003 — Categoria

- **Sub-módulo**: KB
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Criar categoria
  2. Atribuir artigo
- **Resultado esperado**: Artigo aparece na categoria

### QA-KB-004 — Busca

- **Sub-módulo**: KB
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Vários artigos
- **Passos**:
  1. Buscar termo
- **Resultado esperado**: Resultados relevantes

### QA-KB-005 — Acesso cliente /portal/$token

- **Sub-módulo**: Portal
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Token válido
- **Passos**:
  1. Abrir link
- **Resultado esperado**: Cliente vê pedidos/faturas próprios; sem leak

### QA-KB-006 — Branding white-label

- **Sub-módulo**: Portal
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: Branding config
- **Passos**:
  1. Abrir portal
- **Resultado esperado**: Logo/cores aplicadas

### QA-KB-007 — Logo/favicon personalizado

- **Sub-módulo**: Portal
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: Upload
- **Passos**:
  1. Settings > Branding
- **Resultado esperado**: Aplicado no portal e e-mails

### QA-KB-008 — Token revogado

- **Sub-módulo**: Portal
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Revogar
- **Passos**:
  1. Abrir link
- **Resultado esperado**: Acesso negado

### QA-KB-009 — Excluir artigo

- **Sub-módulo**: KB
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Excluir
- **Resultado esperado**: Remoção e cache invalidado

### QA-KB-010 — i18n artigos

- **Sub-módulo**: KB
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Locale
- **Passos**:
  1. Definir locale do artigo
- **Resultado esperado**: Roteamento por idioma correto (se aplicável)

## 13. Automação (Workflows/Sequences/Scoring/AI)

### QA-AUTO-001 — Criar workflow

- **Sub-módulo**: Workflow
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. /settings/workflows > Novo
  2. Gatilho contato criado
  3. Ação enviar e-mail
- **Resultado esperado**: Workflow ativo

### QA-AUTO-002 — Disparo por evento

- **Sub-módulo**: Workflow
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Workflow ativo
- **Passos**:
  1. Criar contato
- **Resultado esperado**: workflow_runs criado; ação executada

### QA-AUTO-003 — Falha em ação

- **Sub-módulo**: Workflow
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Ação inválida
- **Passos**:
  1. Forçar erro
- **Resultado esperado**: Run marcada failed com motivo; retry conforme política

### QA-AUTO-004 — Editar workflow em execução

- **Sub-módulo**: Workflow
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Editar
- **Resultado esperado**: Versão nova; runs antigas concluem na versão antiga

### QA-AUTO-005 — Criar sequência

- **Sub-módulo**: Sequence
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Plano Bronze+
- **Passos**:
  1. Settings > Sequences
- **Resultado esperado**: Sequência criada com passos

### QA-AUTO-006 — Enroll contato

- **Sub-módulo**: Sequence
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Contato
- **Passos**:
  1. Enroll
- **Resultado esperado**: sequence_enrollments criado; primeiro step agendado

### QA-AUTO-007 — Resposta pausa sequência

- **Sub-módulo**: Sequence
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Reply detectado
- **Passos**:
  1. Contato responde
- **Resultado esperado**: Enrollment paused

### QA-AUTO-008 — Regra de score

- **Sub-módulo**: Scoring
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Settings > Scoring > Nova regra
- **Resultado esperado**: Regra ativa; score atualizado em eventos

### QA-AUTO-009 — IA scoring (Prata+)

- **Sub-módulo**: Scoring
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Plano Prata+
- **Passos**:
  1. Habilitar
- **Resultado esperado**: Modelo atribui score; score_events log

### QA-AUTO-010 — Cursors por workspace

- **Sub-módulo**: Scoring
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Múltiplas workspaces
- **Passos**:
  1. Tick agendado
- **Resultado esperado**: scoring_cursors avançam sem sobreposição

### QA-AUTO-011 — AI summary de conversa

- **Sub-módulo**: AI
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Conversa longa
- **Passos**:
  1. Botão Resumir
- **Resultado esperado**: ai_summaries criado; tokens controlados

### QA-AUTO-012 — Limite de créditos IA

- **Sub-módulo**: AI
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Cota esgotada
- **Passos**:
  1. Pedir resumo
- **Resultado esperado**: Bloqueio com banner upgrade

### QA-AUTO-013 — Script SDR

- **Sub-módulo**: Prospect
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Playbook
- **Passos**:
  1. Iniciar discagem
- **Resultado esperado**: Script seguido passo a passo

### QA-AUTO-014 — Ramificação condicional

- **Sub-módulo**: Workflow
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Branches
- **Passos**:
  1. Configurar IF
- **Resultado esperado**: Caminho correto executado conforme condição

### QA-AUTO-015 — Step com tarefa manual

- **Sub-módulo**: Sequence
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Avançar step
- **Resultado esperado**: Tarefa criada para responsável

### QA-AUTO-016 — Ação webhook outbound

- **Sub-módulo**: Workflow
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Webhook URL
- **Passos**:
  1. Disparar workflow
- **Resultado esperado**: POST entregue; webhook_deliveries log

### QA-AUTO-017 — Retry com backoff

- **Sub-módulo**: Workflow
- **Prioridade**: P2 | **Tipo**: Resiliência | **Smoke**: —
- **Pré-condições**: Webhook falhando
- **Passos**:
  1. URL retorna 500
- **Resultado esperado**: Retries exponenciais; após N, marcado failed

### QA-AUTO-018 — Desinscrição em massa

- **Sub-módulo**: Sequence
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Lista
- **Passos**:
  1. Bulk action
- **Resultado esperado**: Enrollments cancelados; sem novos envios

### QA-AUTO-019 — Recalcular tudo

- **Sub-módulo**: Scoring
- **Prioridade**: P2 | **Tipo**: Performance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Botão Recalcular
- **Resultado esperado**: Job em background; sem travar UI

### QA-AUTO-020 — Latência aceitável

- **Sub-módulo**: AI
- **Prioridade**: P3 | **Tipo**: Performance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Pedir resumo
- **Resultado esperado**: Resposta <30s; estado de loading

### QA-AUTO-021 — Provider down

- **Sub-módulo**: AI
- **Prioridade**: P2 | **Tipo**: Resiliência | **Smoke**: —
- **Pré-condições**: Lovable AI offline
- **Passos**:
  1. Pedir resumo
- **Resultado esperado**: Erro gracioso; retry sugerido

### QA-AUTO-022 — Desativar workflow

- **Sub-módulo**: Workflow
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Toggle off
- **Resultado esperado**: Novos eventos não disparam; runs ativos terminam

### QA-AUTO-023 — Encerrar enrollment ao converter

- **Sub-módulo**: Sequence
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Lead convertido
- **Passos**:
  1. Converter
- **Resultado esperado**: Sequência encerra automaticamente

### QA-AUTO-024 — Auditoria de score_events

- **Sub-módulo**: Scoring
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Inspecionar tabela
- **Resultado esperado**: Eventos com origem (regra/IA)

### QA-AUTO-025 — Permissão de criação

- **Sub-módulo**: Workflow
- **Prioridade**: P2 | **Tipo**: Permissão | **Smoke**: —
- **Pré-condições**: Sales
- **Passos**:
  1. Tentar criar
- **Resultado esperado**: Bloqueado; somente admin

## 14. Integrações & Marketplace

### QA-INTEG-001 — Conectar HubSpot

- **Sub-módulo**: HubSpot
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Conector
- **Passos**:
  1. Settings > HubSpot Sync > Conectar
- **Resultado esperado**: OAuth ok; integrations row criado

### QA-INTEG-002 — Importar contatos

- **Sub-módulo**: HubSpot
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Conta conectada
- **Passos**:
  1. Iniciar import
- **Resultado esperado**: hubspot_sync_state avança; contatos espelhados

### QA-INTEG-003 — Mapear owners

- **Sub-módulo**: HubSpot
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Settings > HubSpot users
- **Resultado esperado**: Owners HubSpot mapeados a usuários CRM

### QA-INTEG-004 — Desconectar

- **Sub-módulo**: HubSpot
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Desconectar
- **Resultado esperado**: Tokens revogados; sync pausa

### QA-INTEG-005 — Conectar Slack

- **Sub-módulo**: Slack
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Settings > Notifications > Slack > Conectar
- **Resultado esperado**: slack_integrations criado

### QA-INTEG-006 — Event route

- **Sub-módulo**: Slack
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Canal config
- **Passos**:
  1. Configurar regra: novo deal → canal
- **Resultado esperado**: Mensagem postada em novo deal

### QA-INTEG-007 — Subscribe trigger

- **Sub-módulo**: Zapier
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Zap externo
- **Passos**:
  1. Zapier subscribe webhook
- **Resultado esperado**: zapier_subscriptions registrado

### QA-INTEG-008 — Trigger novo lead

- **Sub-módulo**: Zapier
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Zap ativo
- **Passos**:
  1. Criar lead
- **Resultado esperado**: Webhook Zapier disparado

### QA-INTEG-009 — Unsubscribe

- **Sub-módulo**: Zapier
- **Prioridade**: P3 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Zap desativado
- **Resultado esperado**: Subscription removida

### QA-INTEG-010 — Criar usuário via SCIM

- **Sub-módulo**: SCIM
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Token válido
- **Passos**:
  1. POST /api/public/scim/v2/Users
- **Resultado esperado**: Usuário provisionado; bearer validado

### QA-INTEG-011 — Token inválido

- **Sub-módulo**: SCIM
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. POST sem bearer
- **Resultado esperado**: 401

### QA-INTEG-012 — Atualizar grupo

- **Sub-módulo**: SCIM
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Grupo existente
- **Passos**:
  1. PATCH Group
- **Resultado esperado**: Membros atualizados

### QA-INTEG-013 — Cadastrar outbound

- **Sub-módulo**: Webhook
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Settings > Webhooks > Novo
- **Resultado esperado**: Webhook criado; assinatura HMAC config

### QA-INTEG-014 — Entrega com assinatura

- **Sub-módulo**: Webhook
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Evento
- **Passos**:
  1. Disparar
- **Resultado esperado**: POST com X-Signature; webhook_deliveries success

### QA-INTEG-015 — Retentativa após 500

- **Sub-módulo**: Webhook
- **Prioridade**: P2 | **Tipo**: Resiliência | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. URL retorna 500
- **Resultado esperado**: Retries persistentes; status failed após N

### QA-INTEG-016 — Gerar API key

- **Sub-módulo**: APIKey
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Settings > API Keys > Nova
- **Resultado esperado**: Chave exibida 1x; hash salvo

### QA-INTEG-017 — Uso de API key

- **Sub-módulo**: APIKey
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Chave válida
- **Passos**:
  1. GET endpoint público autenticado
- **Resultado esperado**: 200; uso loga IP/timestamp

### QA-INTEG-018 — Chave revogada

- **Sub-módulo**: APIKey
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Revogada
- **Passos**:
  1. Usar
- **Resultado esperado**: 401

### QA-INTEG-019 — Instalar app

- **Sub-módulo**: Marketplace
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: App listado
- **Passos**:
  1. Marketplace > Install
- **Resultado esperado**: marketplace_installations criado

### QA-INTEG-020 — Desinstalar

- **Sub-módulo**: Marketplace
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Uninstall
- **Resultado esperado**: Permissões revogadas

### QA-INTEG-021 — Sync incremental cron

- **Sub-módulo**: HubSpot
- **Prioridade**: P2 | **Tipo**: Performance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Aguardar tick
- **Resultado esperado**: Apenas deltas processados

### QA-INTEG-022 — Permissão de canal

- **Sub-módulo**: Slack
- **Prioridade**: P2 | **Tipo**: Resiliência | **Smoke**: —
- **Pré-condições**: Bot sem acesso
- **Passos**:
  1. Disparar
- **Resultado esperado**: Erro tratado; alerta admin

### QA-INTEG-023 — Validação de URL HTTPS

- **Sub-módulo**: Webhook
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: HTTP plano
- **Passos**:
  1. Tentar salvar HTTP
- **Resultado esperado**: Bloqueado; somente HTTPS

### QA-INTEG-024 — Logs centralizados

- **Sub-módulo**: Integration
- **Prioridade**: P3 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. /settings/integrations > Logs
- **Resultado esperado**: Eventos de cada integração com filtros

### QA-INTEG-025 — Escopos

- **Sub-módulo**: APIKey
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Chave escopo leitura
- **Passos**:
  1. Tentar POST
- **Resultado esperado**: 403

## 15. Settings

### QA-SET-001 — Acessar /settings/pipelines

- **Sub-módulo**: pipelines
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/pipelines
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-002 — Acessar /settings/custom-properties

- **Sub-módulo**: custom-properties
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/custom-properties
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-003 — Acessar /settings/custom-objects

- **Sub-módulo**: custom-objects
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/custom-objects
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-004 — Acessar /settings/lead-sources

- **Sub-módulo**: lead-sources
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/lead-sources
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-005 — Acessar /settings/products

- **Sub-módulo**: products
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/products
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-006 — Acessar /settings/email-templates

- **Sub-módulo**: email-templates
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/email-templates
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-007 — Acessar /settings/whatsapp-templates

- **Sub-módulo**: whatsapp-templates
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/whatsapp-templates
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-008 — Acessar /settings/whatsapp-catalogs

- **Sub-módulo**: whatsapp-catalogs
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/whatsapp-catalogs
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-009 — Acessar /settings/forms

- **Sub-módulo**: forms
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/forms
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-010 — Acessar /settings/calendars

- **Sub-módulo**: calendars
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/calendars
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-011 — Acessar /settings/booking

- **Sub-módulo**: booking
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/booking
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-012 — Acessar /settings/roles

- **Sub-módulo**: roles
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/roles
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-013 — Acessar /settings/teams

- **Sub-módulo**: teams
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/teams
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-014 — Acessar /settings/user-groups

- **Sub-módulo**: user-groups
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/user-groups
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-015 — Acessar /settings/access-policy

- **Sub-módulo**: access-policy
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/access-policy
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-016 — Acessar /settings/audit-log

- **Sub-módulo**: audit-log
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/audit-log
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-017 — Acessar /settings/audit-export

- **Sub-módulo**: audit-export
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/audit-export
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-018 — Acessar /settings/security

- **Sub-módulo**: security
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/security
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-019 — Acessar /settings/privacy

- **Sub-módulo**: privacy
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/privacy
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-020 — Acessar /settings/language

- **Sub-módulo**: language
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/language
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-021 — Acessar /settings/branding

- **Sub-módulo**: branding
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/branding
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-022 — Acessar /settings/billing

- **Sub-módulo**: billing
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/billing
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-023 — Acessar /settings/payments

- **Sub-módulo**: payments
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/payments
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-024 — Acessar /settings/recurring

- **Sub-módulo**: recurring
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/recurring
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-025 — Acessar /settings/dunning

- **Sub-módulo**: dunning
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/dunning
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-026 — Acessar /settings/nfse

- **Sub-módulo**: nfse
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/nfse
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-027 — Acessar /settings/esign

- **Sub-módulo**: esign
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/esign
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-028 — Acessar /settings/clauses

- **Sub-módulo**: clauses
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/clauses
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-029 — Acessar /settings/quote-templates

- **Sub-módulo**: quote-templates
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/quote-templates
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-030 — Acessar /settings/kb

- **Sub-módulo**: kb
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/kb
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-031 — Acessar /settings/macros

- **Sub-módulo**: macros
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/macros
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-032 — Acessar /settings/sla

- **Sub-módulo**: sla
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/sla
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-033 — Acessar /settings/playbooks

- **Sub-módulo**: playbooks
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/playbooks
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-034 — Acessar /settings/surveys

- **Sub-módulo**: surveys
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/surveys
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-035 — Acessar /settings/goals

- **Sub-módulo**: goals
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/goals
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-036 — Acessar /settings/scoring

- **Sub-módulo**: scoring
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/scoring
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-037 — Acessar /settings/sequences

- **Sub-módulo**: sequences
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/sequences
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-038 — Acessar /settings/workflows

- **Sub-módulo**: workflows
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/workflows
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-039 — Acessar /settings/webhooks

- **Sub-módulo**: webhooks
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/webhooks
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-040 — Acessar /settings/api-keys

- **Sub-módulo**: api-keys
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/api-keys
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-041 — Acessar /settings/zapier

- **Sub-módulo**: zapier
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/zapier
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-042 — Acessar /settings/hubspot-sync

- **Sub-módulo**: hubspot-sync
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/hubspot-sync
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-043 — Acessar /settings/hubspot-users

- **Sub-módulo**: hubspot-users
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/hubspot-users
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-044 — Acessar /settings/ads-sync

- **Sub-módulo**: ads-sync
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/ads-sync
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-045 — Acessar /settings/wa-ads

- **Sub-módulo**: wa-ads
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/wa-ads
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-046 — Acessar /settings/voice-agent

- **Sub-módulo**: voice-agent
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/voice-agent
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-047 — Acessar /settings/mobile

- **Sub-módulo**: mobile
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/mobile
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-048 — Acessar /settings/portal

- **Sub-módulo**: portal
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/portal
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-049 — Acessar /settings/widget

- **Sub-módulo**: widget
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/widget
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-050 — Acessar /settings/prospecting

- **Sub-módulo**: prospecting
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/prospecting
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-051 — Acessar /settings/scripts

- **Sub-módulo**: scripts
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/scripts
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-052 — Acessar /settings/segments

- **Sub-módulo**: segments
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/segments
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-053 — Acessar /settings/rotation

- **Sub-módulo**: rotation
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/rotation
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-054 — Acessar /settings/record-layouts

- **Sub-módulo**: record-layouts
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/record-layouts
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-055 — Acessar /settings/property-groups

- **Sub-módulo**: property-groups
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/property-groups
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-056 — Acessar /settings/notifications-slack

- **Sub-módulo**: notifications-slack
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/notifications-slack
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-057 — Acessar /settings/data-residency

- **Sub-módulo**: data-residency
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/data-residency
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-058 — Acessar /settings/exports

- **Sub-módulo**: exports
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/exports
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-059 — Acessar /settings/import-csv

- **Sub-módulo**: import-csv
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/import-csv
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-060 — Acessar /settings/enrichment

- **Sub-módulo**: enrichment
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/enrichment
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-061 — Acessar /settings/scim

- **Sub-módulo**: scim
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/scim
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-062 — Acessar /settings/workspace-team

- **Sub-módulo**: workspace-team
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/workspace-team
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-063 — Acessar /settings/media

- **Sub-módulo**: media
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Navegar até /settings/media
- **Resultado esperado**: Página carrega sem erros; CTA principal visível

### QA-SET-064 — Matriz de permissões: viewer não vê settings sensíveis

- **Sub-módulo**: roles
- **Prioridade**: P0 | **Tipo**: Permissão | **Smoke**: ✅
- **Pré-condições**: Viewer
- **Passos**:
  1. Logar como viewer
  2. Tentar /settings/api-keys
- **Resultado esperado**: Acesso negado/redirect

### QA-SET-065 — Editor de perfil de acesso

- **Sub-módulo**: roles
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Criar profile com tools custom
- **Resultado esperado**: Persistência em access_profiles e tools

### QA-SET-066 — CRUD de time

- **Sub-módulo**: teams
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Criar/editar/excluir
- **Resultado esperado**: Persistência consistente

### QA-SET-067 — Filtrar log

- **Sub-módulo**: audit-log
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Aplicar filtro por user/ação
- **Resultado esperado**: Resultados corretos

### QA-SET-068 — Exportar audit

- **Sub-módulo**: audit-export
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Solicitar export
- **Resultado esperado**: audit_export_runs gera arquivo; download disponível

### QA-SET-069 — Rodar varredura

- **Sub-módulo**: security
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Admin
- **Passos**:
  1. Botão Run scan
- **Resultado esperado**: Job iniciado; resultado em security_scan_runs/findings

### QA-SET-070 — Upload de logo

- **Sub-módulo**: branding
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Upload PNG
- **Resultado esperado**: Aplicado em portal/e-mails/widget

### QA-SET-071 — Ver plano atual e cotas

- **Sub-módulo**: billing
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. Acessar /settings/billing
- **Resultado esperado**: Plano, cotas e botão de upgrade exibidos

### QA-SET-072 — Selecionar região

- **Sub-módulo**: data-residency
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Plano Ouro
- **Passos**:
  1. Selecionar BR
- **Resultado esperado**: Persistência; banner informa migração se necessária

### QA-SET-073 — Upload arquivo grande

- **Sub-módulo**: import-csv
- **Prioridade**: P2 | **Tipo**: Performance | **Smoke**: —
- **Pré-condições**: CSV 50k linhas
- **Passos**:
  1. Upload
- **Resultado esperado**: Processamento em background; progresso visível

### QA-SET-074 — Listar/criar/revogar

- **Sub-módulo**: api-keys
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Fluxo completo
- **Resultado esperado**: Persistência e segurança

### QA-SET-075 — Convidar usuário

- **Sub-módulo**: workspace-team
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. Convidar
  2. Selecionar role
- **Resultado esperado**: workspace_invites criado; e-mail enviado

### QA-SET-076 — Remover usuário

- **Sub-módulo**: workspace-team
- **Prioridade**: P1 | **Tipo**: Permissão | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Remover
- **Resultado esperado**: Acesso revogado imediatamente

### QA-SET-077 — Item SSO removido do sidebar

- **Sub-módulo**: sso
- **Prioridade**: P1 | **Tipo**: UI | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. Acessar /settings
- **Resultado esperado**: Menu não exibe 'SSO'; rota /settings/sso permanece acessível por URL direta sem quebrar

### QA-SET-078 — Trocar idioma

- **Sub-módulo**: language
- **Prioridade**: P2 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Selecionar pt-BR/en-US
- **Resultado esperado**: UI muda; preferência persistida

### QA-SET-079 — Solicitar exportação LGPD

- **Sub-módulo**: privacy
- **Prioridade**: P1 | **Tipo**: Compliance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Solicitar export de dados
- **Resultado esperado**: Job processado; e-mail com link assinado

### QA-SET-080 — Solicitar exclusão LGPD

- **Sub-módulo**: privacy
- **Prioridade**: P1 | **Tipo**: Compliance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Solicitar exclusão
- **Resultado esperado**: Pipeline de anonimização; confirmação

## 16. Billing & Entitlements

### QA-BILL-001 — Página /settings/billing

- **Sub-módulo**: Billing
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. Acessar
- **Resultado esperado**: Plano atual + comparativo + uso atual

### QA-BILL-002 — Upgrade Free → Bronze

- **Sub-módulo**: Billing
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. Selecionar Bronze
  2. Confirmar pagamento
- **Resultado esperado**: workspace_subscriptions atualizado; features Bronze liberadas

### QA-BILL-003 — Upgrade Bronze → Prata

- **Sub-módulo**: Billing
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. Selecionar Prata
- **Resultado esperado**: Features Prata (campanhas WA, IA scoring) liberadas

### QA-BILL-004 — Upgrade Prata → Ouro

- **Sub-módulo**: Billing
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Selecionar Ouro
- **Resultado esperado**: Features ouro liberadas

### QA-BILL-005 — Downgrade com aviso de perdas

- **Sub-módulo**: Billing
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Ouro → Pro/Prata
- **Passos**:
  1. Selecionar plano inferior
- **Resultado esperado**: Aviso listando features que deixarão de funcionar; confirmação obrigatória

### QA-BILL-006 — FeatureGate bloqueia em Free

- **Sub-módulo**: Entitlement
- **Prioridade**: P0 | **Tipo**: Permissão | **Smoke**: ✅
- **Pré-condições**: Free + WhatsApp
- **Passos**:
  1. Acessar /campaigns/whatsapp
- **Resultado esperado**: Gate exibe CTA upgrade; sem permitir uso

### QA-BILL-007 — FeatureGate em Bronze para Prata-only

- **Sub-módulo**: Entitlement
- **Prioridade**: P1 | **Tipo**: Permissão | **Smoke**: —
- **Pré-condições**: Bronze + IA scoring
- **Passos**:
  1. Tentar habilitar IA scoring
- **Resultado esperado**: Bloqueado com CTA

### QA-BILL-008 — LimitBadge mostra uso/quota

- **Sub-módulo**: Entitlement
- **Prioridade**: P1 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: Free 500 contatos
- **Passos**:
  1. Ver badge
- **Resultado esperado**: Mostra atual/limite; muda cor ao se aproximar do limite

### QA-BILL-009 — Bloqueio ao exceder cota de contatos

- **Sub-módulo**: Entitlement
- **Prioridade**: P0 | **Tipo**: Permissão | **Smoke**: ✅
- **Pré-condições**: Free no limite
- **Passos**:
  1. Tentar criar 501º contato
- **Resultado esperado**: Bloqueado com upgrade modal

### QA-BILL-010 — Cota de e-mails

- **Sub-módulo**: Entitlement
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Quota mensal
- **Passos**:
  1. Enviar broadcast acima
- **Resultado esperado**: Bloqueia próximos envios; banner upgrade

### QA-BILL-011 — Cota IA

- **Sub-módulo**: Entitlement
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Créditos esgotados
- **Passos**:
  1. Usar AI summary
- **Resultado esperado**: Bloqueado; banner upgrade

### QA-BILL-012 — Cota Twilio voz

- **Sub-módulo**: Entitlement
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Limite
- **Passos**:
  1. Discar acima
- **Resultado esperado**: Bloqueado; mensagem clara

### QA-BILL-013 — Banner upgrade global

- **Sub-módulo**: Billing
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: Próximo do limite
- **Passos**:
  1. Logar
- **Resultado esperado**: Banner persistente até resolver

### QA-BILL-014 — Pagamento falhou

- **Sub-módulo**: Billing
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Cartão recusado
- **Passos**:
  1. Tentar upgrade
- **Resultado esperado**: Mensagem clara; plano não muda

### QA-BILL-015 — Renovação automática

- **Sub-módulo**: Billing
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Sub ativa
- **Passos**:
  1. Próxima cobrança
- **Resultado esperado**: subscription_invoices gerada; status renewed

### QA-BILL-016 — Cancelar plano

- **Sub-módulo**: Billing
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Sub ativa
- **Passos**:
  1. Cancelar
- **Resultado esperado**: Acesso mantido até fim do período; downgrade automático

### QA-BILL-017 — Fatura PDF

- **Sub-módulo**: Billing
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Sub ativa
- **Passos**:
  1. Botão Baixar
- **Resultado esperado**: PDF gerado com dados corretos

### QA-BILL-018 — Múltiplas moedas (se aplicável)

- **Sub-módulo**: Billing
- **Prioridade**: P3 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: Config
- **Passos**:
  1. Mostrar BRL
- **Resultado esperado**: Formato pt-BR

### QA-BILL-019 — Auditoria de mudanças de plano

- **Sub-módulo**: Billing
- **Prioridade**: P2 | **Tipo**: Compliance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Histórico
- **Resultado esperado**: Eventos registrados

### QA-BILL-020 — Plano free permanente

- **Sub-módulo**: Billing
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Não fornecer cartão
- **Resultado esperado**: Permite criar e usar dentro dos limites

## 17. Admin de Plataforma

### QA-ADMIN-001 — Acesso negado sem platform_admin

- **Sub-módulo**: Guard
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Sales
- **Passos**:
  1. Acessar /admin/workspaces
- **Resultado esperado**: 403/redirect; sem leak de dados

### QA-ADMIN-002 — Listar workspaces

- **Sub-módulo**: Workspaces
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: Platform admin
- **Passos**:
  1. /admin/workspaces
- **Resultado esperado**: Tabela paginada com plano e métricas básicas

### QA-ADMIN-003 — Detalhe de workspace

- **Sub-módulo**: Workspaces
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Abrir um WS
- **Resultado esperado**: Membros, plano, uso, ações admin visíveis

### QA-ADMIN-004 — Set plan manual

- **Sub-módulo**: Workspaces
- **Prioridade**: P0 | **Tipo**: Funcional | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. Trocar plano para Ouro
- **Resultado esperado**: workspace_subscriptions atualizado; auditoria gerada

### QA-ADMIN-005 — /admin/quotas

- **Sub-módulo**: Quotas
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Acessar
- **Resultado esperado**: Cotas globais visíveis; edição funciona

### QA-ADMIN-006 — /admin/bug-reports listagem

- **Sub-módulo**: BugReports
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Acessar
- **Resultado esperado**: Tabela com filtros por status

### QA-ADMIN-007 — Disparar análise IA

- **Sub-módulo**: BugReports
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Bug report aberto
- **Passos**:
  1. Botão Analyze
- **Resultado esperado**: bug_report_analyses criado; hook bug-report-analyze-tick processa

### QA-ADMIN-008 — Atualizar status

- **Sub-módulo**: BugReports
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Mudar para resolved
- **Resultado esperado**: Persistência e notificação ao reporter

### QA-ADMIN-009 — /admin/security-scans

- **Sub-módulo**: Security
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Acessar
  2. Run scan
- **Resultado esperado**: Job em background; findings após conclusão

### QA-ADMIN-010 — Manage finding

- **Sub-módulo**: Security
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Finding ativo
- **Passos**:
  1. Ignorar com justificativa
- **Resultado esperado**: Status alterado; auditoria mantida

### QA-ADMIN-011 — Rules CRUD

- **Sub-módulo**: Alerts
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Criar regra
- **Resultado esperado**: platform_alert_rules persistido

### QA-ADMIN-012 — Disparo de evento

- **Sub-módulo**: Alerts
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Rule matching
- **Passos**:
  1. Trigger
- **Resultado esperado**: platform_alert_events log; notificação

### QA-ADMIN-013 — Criar sandbox

- **Sub-módulo**: Sandbox
- **Prioridade**: P3 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. /admin/sandbox > Criar
- **Resultado esperado**: Sandbox provisionada

### QA-ADMIN-014 — /admin/status

- **Sub-módulo**: Status
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Acessar
- **Resultado esperado**: Health checks de banco, queue, integrações

### QA-ADMIN-015 — Suspender workspace

- **Sub-módulo**: Workspaces
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Botão Suspender
- **Resultado esperado**: Acesso bloqueado para todos os usuários do WS

### QA-ADMIN-016 — Restaurar workspace

- **Sub-módulo**: Workspaces
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Suspenso
- **Passos**:
  1. Restaurar
- **Resultado esperado**: Acesso normalizado

### QA-ADMIN-017 — Bloquear workspace ao exceder

- **Sub-módulo**: Quotas
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Quota dura
- **Passos**:
  1. Forçar excesso
- **Resultado esperado**: Workspace recebe banner; ações bloqueadas

### QA-ADMIN-018 — RLS impede ver bugs de outro WS

- **Sub-módulo**: BugReports
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Admin de WS A
- **Passos**:
  1. Buscar bug de WS B via URL
- **Resultado esperado**: Negado

### QA-ADMIN-019 — Linter de schema

- **Sub-módulo**: Security
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Botão Lint
- **Resultado esperado**: Issues do schema listados

### QA-ADMIN-020 — Audit log de ações admin

- **Sub-módulo**: Admin
- **Prioridade**: P1 | **Tipo**: Compliance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Set plan, suspend
- **Resultado esperado**: audit_logs com user platform_admin

### QA-ADMIN-021 — Search global

- **Sub-módulo**: Admin
- **Prioridade**: P2 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Buscar workspace por nome/dom
- **Resultado esperado**: Resultados rápidos

### QA-ADMIN-022 — Métricas agregadas

- **Sub-módulo**: Admin
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Dashboard
- **Resultado esperado**: Totais por plano, MRR, churn

### QA-ADMIN-023 — Impersonate (se existir)

- **Sub-módulo**: Admin
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Botão Impersonate
- **Resultado esperado**: Auditoria explícita; banner persistente; revogável

### QA-ADMIN-024 — Webhook events de Stripe revisão

- **Sub-módulo**: Admin
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: payment_webhook_events
- **Passos**:
  1. Ver lista
- **Resultado esperado**: Eventos com status e replay

### QA-ADMIN-025 — Rate limit do painel

- **Sub-módulo**: Admin
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Burst
- **Passos**:
  1. 100 reqs/min
- **Resultado esperado**: Throttle aplicado

## 18. Bug Reports (Usuário)

### QA-BUG-001 — Acessar /my-bug-reports

- **Sub-módulo**: MyBugReports
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Logado
- **Passos**:
  1. Acessar
- **Resultado esperado**: Lista própria do usuário

### QA-BUG-002 — Criar bug report

- **Sub-módulo**: MyBugReports
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Botão Novo
- **Resultado esperado**: bug_reports criado com browser/OS/URL

### QA-BUG-003 — Anexar print

- **Sub-módulo**: MyBugReports
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Anexar
- **Resultado esperado**: Upload em storage; visível em /admin/bug-reports

### QA-BUG-004 — Ver status atualizado

- **Sub-módulo**: MyBugReports
- **Prioridade**: P2 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Admin moveu para in_progress
- **Passos**:
  1. Recarregar
- **Resultado esperado**: Status refletido

### QA-BUG-005 — RLS: usuário não vê bugs alheios

- **Sub-módulo**: MyBugReports
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. Tentar acessar id alheio
- **Resultado esperado**: Negado

## 19. Rotas Públicas / Webhooks

### QA-PUB-001 — GET /api/public/forms/$slug

- **Sub-módulo**: Forms
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. GET embed
- **Resultado esperado**: JSON com schema do form

### QA-PUB-002 — POST submit

- **Sub-módulo**: Forms
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST
- **Resultado esperado**: Submission ok; rate limit ativo

### QA-PUB-003 — GET /api/public/booking/$slug

- **Sub-módulo**: Booking
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. GET
- **Resultado esperado**: Slots disponíveis

### QA-PUB-004 — POST submit

- **Sub-módulo**: Booking
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST
- **Resultado esperado**: Booking criado

### QA-PUB-005 — GET /api/public/unsubscribe

- **Sub-módulo**: Unsub
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Token
- **Passos**:
  1. GET
- **Resultado esperado**: Token valida; unsub persiste

### QA-PUB-006 — Pixel

- **Sub-módulo**: EmailTrack
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. GET
- **Resultado esperado**: Hit registra open

### QA-PUB-007 — Click redirect

- **Sub-módulo**: EmailTrack
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. GET com url
- **Resultado esperado**: 302 + click event

### QA-PUB-008 — Webhook Stripe

- **Sub-módulo**: Payments
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. POST com signing secret
- **Resultado esperado**: Eventos processados; idempotência

### QA-PUB-009 — Webhook BR

- **Sub-módulo**: Payments
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST
- **Resultado esperado**: Validado

### QA-PUB-010 — Twilio voice

- **Sub-módulo**: Voice
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST
- **Resultado esperado**: Signature ok; status atualizado

### QA-PUB-011 — Twilio WhatsApp

- **Sub-módulo**: Voice
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST
- **Resultado esperado**: Signature ok; mensagem persistida

### QA-PUB-012 — Status callback

- **Sub-módulo**: Voice
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST
- **Resultado esperado**: Idempotente

### QA-PUB-013 — WA verify token

- **Sub-módulo**: Meta
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. GET hub.challenge
- **Resultado esperado**: Retorna challenge

### QA-PUB-014 — WA inbound

- **Sub-módulo**: Meta
- **Prioridade**: P0 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST
- **Resultado esperado**: Mensagem cria conversa

### QA-PUB-015 — OAuth callback

- **Sub-módulo**: Google
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. GET callback
- **Resultado esperado**: State validado; tokens salvos

### QA-PUB-016 — script.js

- **Sub-módulo**: Widget
- **Prioridade**: P2 | **Tipo**: Performance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. GET
- **Resultado esperado**: Cache headers; JS válido

### QA-PUB-017 — session start

- **Sub-módulo**: Widget
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST
- **Resultado esperado**: Cria live_chat_session

### QA-PUB-018 — messages

- **Sub-módulo**: Widget
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST
- **Resultado esperado**: Persiste mensagem

### QA-PUB-019 — /sitemap.xml

- **Sub-módulo**: SEO
- **Prioridade**: P2 | **Tipo**: SEO | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. GET
- **Resultado esperado**: Sitemap válido; só rotas públicas

### QA-PUB-020 — /robots.txt

- **Sub-módulo**: SEO
- **Prioridade**: P2 | **Tipo**: SEO | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. GET
- **Resultado esperado**: Disallow rotas privadas

### QA-PUB-021 — Users CRUD

- **Sub-módulo**: SCIM
- **Prioridade**: P1 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: Token
- **Passos**:
  1. POST/GET/PATCH/DELETE
- **Resultado esperado**: Funcional e seguro

### QA-PUB-022 — Groups CRUD

- **Sub-módulo**: SCIM
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. CRUD
- **Resultado esperado**: Funcional

### QA-PUB-023 — Subscribe/unsubscribe/triggers

- **Sub-módulo**: Zapier
- **Prioridade**: P2 | **Tipo**: Integração | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST
- **Resultado esperado**: Funcional

### QA-PUB-024 — GET /quote/$token

- **Sub-módulo**: Quote
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Token válido
- **Passos**:
  1. GET
- **Resultado esperado**: Página pública renderiza

### QA-PUB-025 — GET /sign/$token

- **Sub-módulo**: Sign
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. GET
- **Resultado esperado**: Página de assinatura

## 20. Cron / Hooks Agendados

### QA-CRON-001 — Cron email-broadcast-tick com CRON_SECRET válido

- **Sub-módulo**: email-broadcast
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/email-broadcast-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-002 — Cron email-broadcast-tick sem CRON_SECRET

- **Sub-módulo**: email-broadcast
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-003 — Cron sequences-tick com CRON_SECRET válido

- **Sub-módulo**: sequences
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/sequences-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-004 — Cron sequences-tick sem CRON_SECRET

- **Sub-módulo**: sequences
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-005 — Cron workflows-tick com CRON_SECRET válido

- **Sub-módulo**: workflows
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/workflows-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-006 — Cron workflows-tick sem CRON_SECRET

- **Sub-módulo**: workflows
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-007 — Cron sla-tick com CRON_SECRET válido

- **Sub-módulo**: sla
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/sla-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-008 — Cron sla-tick sem CRON_SECRET

- **Sub-módulo**: sla
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-009 — Cron scoring-tick com CRON_SECRET válido

- **Sub-módulo**: scoring
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/scoring-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-010 — Cron scoring-tick sem CRON_SECRET

- **Sub-módulo**: scoring
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-011 — Cron segments-tick com CRON_SECRET válido

- **Sub-módulo**: segments
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/segments-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-012 — Cron segments-tick sem CRON_SECRET

- **Sub-módulo**: segments
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-013 — Cron hubspot-tick com CRON_SECRET válido

- **Sub-módulo**: hubspot
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/hubspot-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-014 — Cron hubspot-tick sem CRON_SECRET

- **Sub-módulo**: hubspot
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-015 — Cron calendar-tick com CRON_SECRET válido

- **Sub-módulo**: calendar
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/calendar-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-016 — Cron calendar-tick sem CRON_SECRET

- **Sub-módulo**: calendar
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-017 — Cron calendar-recordings-tick com CRON_SECRET válido

- **Sub-módulo**: calendar-recordings
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/calendar-recordings-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-018 — Cron calendar-recordings-tick sem CRON_SECRET

- **Sub-módulo**: calendar-recordings
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-019 — Cron prospecting-dial-tick com CRON_SECRET válido

- **Sub-módulo**: prospecting-dial
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/prospecting-dial-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-020 — Cron prospecting-dial-tick sem CRON_SECRET

- **Sub-módulo**: prospecting-dial
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-021 — Cron audit-export-tick com CRON_SECRET válido

- **Sub-módulo**: audit-export
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/audit-export-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-022 — Cron audit-export-tick sem CRON_SECRET

- **Sub-módulo**: audit-export
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-023 — Cron scheduled-exports-tick com CRON_SECRET válido

- **Sub-módulo**: scheduled-exports
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/scheduled-exports-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-024 — Cron scheduled-exports-tick sem CRON_SECRET

- **Sub-módulo**: scheduled-exports
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-025 — Cron sentiment-tick com CRON_SECRET válido

- **Sub-módulo**: sentiment
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/sentiment-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-026 — Cron sentiment-tick sem CRON_SECRET

- **Sub-módulo**: sentiment
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-027 — Cron security-scan-tick com CRON_SECRET válido

- **Sub-módulo**: security-scan
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/security-scan-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-028 — Cron security-scan-tick sem CRON_SECRET

- **Sub-módulo**: security-scan
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-029 — Cron platform-alerts-tick com CRON_SECRET válido

- **Sub-módulo**: platform-alerts
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/platform-alerts-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-030 — Cron platform-alerts-tick sem CRON_SECRET

- **Sub-módulo**: platform-alerts
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-031 — Cron ai-summary-tick com CRON_SECRET válido

- **Sub-módulo**: ai-summary
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/ai-summary-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-032 — Cron ai-summary-tick sem CRON_SECRET

- **Sub-módulo**: ai-summary
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-033 — Cron webhook-tick com CRON_SECRET válido

- **Sub-módulo**: webhook
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/webhook-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-034 — Cron webhook-tick sem CRON_SECRET

- **Sub-módulo**: webhook
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-035 — Cron whatsapp-campaign-tick com CRON_SECRET válido

- **Sub-módulo**: whatsapp-campaign
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/whatsapp-campaign-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-036 — Cron whatsapp-campaign-tick sem CRON_SECRET

- **Sub-módulo**: whatsapp-campaign
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-037 — Cron bug-report-analyze-tick com CRON_SECRET válido

- **Sub-módulo**: bug-report-analyze
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/bug-report-analyze-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-038 — Cron bug-report-analyze-tick sem CRON_SECRET

- **Sub-módulo**: bug-report-analyze
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-039 — Cron email-sync-tick com CRON_SECRET válido

- **Sub-módulo**: email-sync
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/email-sync-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-040 — Cron email-sync-tick sem CRON_SECRET

- **Sub-módulo**: email-sync
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

### QA-CRON-041 — Cron dunning-tick com CRON_SECRET válido

- **Sub-módulo**: dunning
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Header presente
- **Passos**:
  1. POST /api/public/cron/dunning-tick com header autorizado
- **Resultado esperado**: 200; lote processado; idempotência respeitada

### QA-CRON-042 — Cron dunning-tick sem CRON_SECRET

- **Sub-módulo**: dunning
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. POST sem header ou inválido
- **Resultado esperado**: 401; nenhum trabalho processado

## 21. Segurança & Compliance

### QA-SEC-001 — Leitura cross-workspace de leads

- **Sub-módulo**: RLS
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: 2 WS
- **Passos**:
  1. GET /leads/$id alheio
- **Resultado esperado**: Sem retorno; sem leak

### QA-SEC-002 — Escrita cross-workspace

- **Sub-módulo**: RLS
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. PATCH em id alheio
- **Resultado esperado**: Bloqueada

### QA-SEC-003 — DELETE cross-workspace

- **Sub-módulo**: RLS
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. DELETE id alheio
- **Resultado esperado**: Bloqueado

### QA-SEC-004 — has_role server-side

- **Sub-módulo**: Roles
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: Sales tenta admin
- **Passos**:
  1. Tentar tool admin
- **Resultado esperado**: Bloqueado por has_role

### QA-SEC-005 — Mutação user_roles bloqueada

- **Sub-módulo**: Roles
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. INSERT em user_roles via client
- **Resultado esperado**: RLS bloqueia

### QA-SEC-006 — service_role nunca exposto

- **Sub-módulo**: Service
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: ✅
- **Pré-condições**: -
- **Passos**:
  1. Inspecionar bundle
- **Resultado esperado**: Sem referência a SUPABASE_SERVICE_ROLE_KEY

### QA-SEC-007 — Twilio assinatura

- **Sub-módulo**: Webhook
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Calcular hash inválido
- **Resultado esperado**: 401

### QA-SEC-008 — Stripe assinatura

- **Sub-módulo**: Webhook
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Sig errada
- **Resultado esperado**: 401

### QA-SEC-009 — Meta verify token

- **Sub-módulo**: Webhook
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Token errado
- **Resultado esperado**: 403

### QA-SEC-010 — Login throttle

- **Sub-módulo**: Rate
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Bursts
- **Resultado esperado**: Limites aplicados

### QA-SEC-011 — ip_access_log

- **Sub-módulo**: IP
- **Prioridade**: P2 | **Tipo**: Compliance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Login
- **Resultado esperado**: Persiste IP/UA

### QA-SEC-012 — Audit logs em ações sensíveis

- **Sub-módulo**: Audit
- **Prioridade**: P1 | **Tipo**: Compliance | **Smoke**: —
- **Pré-condições**: Set plan
- **Passos**:
  1. Executar
- **Resultado esperado**: audit_logs persistido

### QA-SEC-013 — Exportação LGPD

- **Sub-módulo**: Privacy
- **Prioridade**: P1 | **Tipo**: Compliance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Solicitar
- **Resultado esperado**: Arquivo com dados do usuário

### QA-SEC-014 — Exclusão LGPD

- **Sub-módulo**: Privacy
- **Prioridade**: P1 | **Tipo**: Compliance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Solicitar
- **Resultado esperado**: Anonimização concluída

### QA-SEC-015 — CSRF em form público

- **Sub-módulo**: Forms
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Verificar tokens
- **Resultado esperado**: Defesas adequadas (origem/honeypot)

### QA-SEC-016 — Sanitização rich text

- **Sub-módulo**: XSS
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Inserir HTML
- **Resultado esperado**: Render seguro no público

### QA-SEC-017 — Headers de segurança

- **Sub-módulo**: CSP
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Inspecionar response
- **Resultado esperado**: CSP, X-Frame, X-Content-Type, Referrer-Policy

### QA-SEC-018 — robots/sitemap não vazam rotas privadas

- **Sub-módulo**: SEO
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. GET
- **Resultado esperado**: Disallow correto

### QA-SEC-019 — Brute force key

- **Sub-módulo**: APIKey
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Múltiplas chaves erradas
- **Resultado esperado**: Throttle

### QA-SEC-020 — Sessão revogada após logout

- **Sub-módulo**: Session
- **Prioridade**: P1 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Logout em uma aba
- **Resultado esperado**: Outra aba perde sessão na próxima request

### QA-SEC-021 — Acesso a arquivo de outro WS

- **Sub-módulo**: Storage
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. URL direta
- **Resultado esperado**: Negado

### QA-SEC-022 — Subscription cross-WS

- **Sub-módulo**: Realtime
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Subscrever channel alheio
- **Resultado esperado**: Sem eventos recebidos

### QA-SEC-023 — HSTS

- **Sub-módulo**: Headers
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. curl -I
- **Resultado esperado**: Strict-Transport-Security presente

### QA-SEC-024 — Mensagens não vazam stack

- **Sub-módulo**: Errors
- **Prioridade**: P2 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Disparar erro
- **Resultado esperado**: UI mostra mensagem amigável; sem stacktrace

### QA-SEC-025 — Bypass de \_authenticated

- **Sub-módulo**: AdminGuard
- **Prioridade**: P0 | **Tipo**: Segurança | **Smoke**: —
- **Pré-condições**: Token forjado
- **Passos**:
  1. Tentar
- **Resultado esperado**: Bloqueado

## 22. UX Transversal & Acessibilidade

### QA-UX-001 — Mobile 375px

- **Sub-módulo**: Responsivo
- **Prioridade**: P1 | **Tipo**: UI | **Smoke**: ✅
- **Pré-condições**: Páginas chave
- **Passos**:
  1. Abrir em 375px
- **Resultado esperado**: Sem overflow horizontal; menus colapsam

### QA-UX-002 — Tablet 768px

- **Sub-módulo**: Responsivo
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Abrir
- **Resultado esperado**: Layout adapta

### QA-UX-003 — 1920px

- **Sub-módulo**: Desktop
- **Prioridade**: P2 | **Tipo**: UI | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Abrir
- **Resultado esperado**: Sem larguras quebradas

### QA-UX-004 — Toggle (se disponível)

- **Sub-módulo**: DarkMode
- **Prioridade**: P2 | **Tipo**: Acessibilidade | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Alternar
- **Resultado esperado**: Sem contraste insuficiente

### QA-UX-005 — Navegar com Tab

- **Sub-módulo**: Teclado
- **Prioridade**: P2 | **Tipo**: Acessibilidade | **Smoke**: —
- **Pré-condições**: Forms
- **Passos**:
  1. Tab por campos
- **Resultado esperado**: Foco visível; ordem lógica

### QA-UX-006 — Botões e ícones

- **Sub-módulo**: ARIA
- **Prioridade**: P2 | **Tipo**: Acessibilidade | **Smoke**: —
- **Pré-condições**: Inbox
- **Passos**:
  1. Inspecionar
- **Resultado esperado**: aria-label adequados

### QA-UX-007 — Mensagens de sucesso/erro

- **Sub-módulo**: Toasts
- **Prioridade**: P2 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: Ações
- **Passos**:
  1. Executar ações
- **Resultado esperado**: Toasts visíveis e acessíveis

### QA-UX-008 — Skeletons

- **Sub-módulo**: Loading
- **Prioridade**: P2 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: Listas grandes
- **Passos**:
  1. Carregar
- **Resultado esperado**: Skeletons exibidos antes do dado

### QA-UX-009 — Empty states

- **Sub-módulo**: Empty
- **Prioridade**: P2 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: Lista vazia
- **Passos**:
  1. Abrir
- **Resultado esperado**: Mensagem + CTA

### QA-UX-010 — Cmd+K

- **Sub-módulo**: Shortcuts
- **Prioridade**: P2 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Pressionar
- **Resultado esperado**: Command palette abre

### QA-UX-011 — Ordenação persistente

- **Sub-módulo**: Sort
- **Prioridade**: P2 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Ordenar coluna
  2. Recarregar
- **Resultado esperado**: Preferência mantida (user_grid_preferences)

### QA-UX-012 — Filtros persistentes

- **Sub-módulo**: Filter
- **Prioridade**: P2 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Aplicar
- **Resultado esperado**: Persistência cross-session

### QA-UX-013 — pt-BR/en-US

- **Sub-módulo**: i18n
- **Prioridade**: P2 | **Tipo**: Acessibilidade | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Trocar idioma
- **Resultado esperado**: Strings traduzidas

### QA-UX-014 — Contraste mínimo AA

- **Sub-módulo**: A11y
- **Prioridade**: P2 | **Tipo**: Acessibilidade | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Ferramenta de contraste
- **Resultado esperado**: Conforme WCAG AA

### QA-UX-015 — Confirmação para ações destrutivas

- **Sub-módulo**: UX
- **Prioridade**: P1 | **Tipo**: UX | **Smoke**: —
- **Pré-condições**: Excluir
- **Passos**:
  1. Clicar Excluir
- **Resultado esperado**: Modal de confirmação obrigatório

## 23. Performance & Resiliência

### QA-PERF-001 — Tempo de carga inicial

- **Sub-módulo**: Init
- **Prioridade**: P2 | **Tipo**: Performance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Lighthouse na /dashboard
- **Resultado esperado**: TTI < 3s em conexão padrão

### QA-PERF-002 — Virtualização em listas grandes

- **Sub-módulo**: Lista
- **Prioridade**: P2 | **Tipo**: Performance | **Smoke**: —
- **Pré-condições**: 10k itens
- **Passos**:
  1. Rolar
- **Resultado esperado**: Sem travamentos; memoização efetiva

### QA-PERF-003 — Reconexão após drop

- **Sub-módulo**: Realtime
- **Prioridade**: P2 | **Tipo**: Resiliência | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Derrubar rede 5s e religar
- **Resultado esperado**: Subscrições reconectam automaticamente

### QA-PERF-004 — Retry em mutation

- **Sub-módulo**: Mutations
- **Prioridade**: P2 | **Tipo**: Resiliência | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Simular 500
- **Resultado esperado**: Retry exponencial; toast claro

### QA-PERF-005 — Service worker (sw.js)

- **Sub-módulo**: Offline
- **Prioridade**: P3 | **Tipo**: Resiliência | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. DevTools offline
- **Resultado esperado**: Shell carrega; ações enfileiradas

### QA-PERF-006 — TanStack Query invalidate

- **Sub-módulo**: Cache
- **Prioridade**: P1 | **Tipo**: Funcional | **Smoke**: —
- **Pré-condições**: Mutation
- **Passos**:
  1. Criar/editar
- **Resultado esperado**: Lista atualiza sem refresh manual

### QA-PERF-007 — Tamanho do bundle

- **Sub-módulo**: Bundles
- **Prioridade**: P3 | **Tipo**: Performance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Análise
- **Resultado esperado**: Sem regressão >10% vs baseline

### QA-PERF-008 — ServerFn cold start

- **Sub-módulo**: Server
- **Prioridade**: P3 | **Tipo**: Performance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Primeiro hit
- **Resultado esperado**: Aceitável (<2s)

### QA-PERF-009 — Limite de payload

- **Sub-módulo**: Edge
- **Prioridade**: P2 | **Tipo**: Resiliência | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Enviar 25MB
- **Resultado esperado**: Tratamento claro

### QA-PERF-010 — Slow query monitor

- **Sub-módulo**: DB
- **Prioridade**: P2 | **Tipo**: Performance | **Smoke**: —
- **Pré-condições**: -
- **Passos**:
  1. Inspecionar
- **Resultado esperado**: Nenhuma query crítica > 1s em volume médio
