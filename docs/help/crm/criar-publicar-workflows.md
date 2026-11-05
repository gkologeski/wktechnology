---
module_key: crm
slug: criar-publicar-workflows
title: Criar e publicar workflows
summary: Salve um rascunho, publique uma versão e acompanhe execuções de automações.
article_type: howto
route_pattern: /settings/workflows
min_permission: system.workflows.manage.workspace
audience: internal
sort_order: 413
version: 2
is_published: true
---
# Criar e publicar workflows
**Para que serve:** Configurar automações, separando o rascunho da versão publicada.
**Quem pode fazer:** Gestor+ ou `system.workflows.manage.workspace`. Decisões de aprovação exigem permissão de aprovação.
**Onde fica:** Menu > TechSales > Otimizar > Workflows (`/settings/workflows`).
**Antes de começar:** Defina o gatilho e as ações. Se houver distribuição, crie a regra antes.

## Passo a passo
1. Abra a aba "Workflows".
2. Crie ou abra um workflow. O editor mostra "Novo workflow" ou "Editar workflow"; preencha o nome.
3. Configure o gatilho e as etapas.
4. Salve o rascunho.
5. Clique em "Salvar rascunho" para guardar sem ativar, ou em "Salvar e publicar".
6. Abra "Execuções recentes".
7. Abra "Política de envio" para revisar regras de envio.
8. Em decisão pendente, preencha "Comentário da decisão (opcional)" e aprove ou rejeite.
<!-- screenshot: abas Workflows, Execuções recentes e Política de envio -->

## Resultado esperado
"Rascunho salvo — publique para ativar"; "Publicado — v…"; "Aprovado — retomada enfileirada".

## Regras e limites
Salvar não é publicar. Aprovar ou rejeitar muda o andamento da execução.

## Erros comuns
- "Erro ao salvar": revise o rascunho.
- "Erro ao publicar": confira a configuração.
- "Erro no teste": revise o registro de teste.
- "Erro ao remover": confira sua autorização.

## Relacionados
- [Criar regras de distribuição](/ajuda/crm/criar-regras-de-distribuicao)
- [Erros comuns](/ajuda/crm/erros-comuns)
