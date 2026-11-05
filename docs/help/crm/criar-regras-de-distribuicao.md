---
module_key: crm
slug: criar-regras-de-distribuicao
title: Criar regras de distribuição
summary: Defina responsáveis e uma estratégia de rodízio para usar em workflows.
article_type: howto
route_pattern: /settings/rotation
min_permission: system.automation.rotation.view.workspace
audience: internal
sort_order: 412
version: 1
is_published: true
---
# Criar regras de distribuição
**Para que serve:** Distribuir leads e negócios entre responsáveis.
**Quem pode fazer:** Gestor+ ou `system.automation.rotation.view.workspace`/`.manage.workspace`. Gravar e excluir exigem gerenciamento.
**Onde fica:** Menu > TechSales > Otimizar > Distribuição (`/settings/rotation`).
**Antes de começar:** A regra é usada no Workflow pela ação "Distribuir via regra".

## Passo a passo
1. Clique em "Nova regra".
2. Preencha "Nome".
3. Escolha "Entidade" e "Estratégia".
4. Em "Responsáveis", use "+ Adicionar membro".
5. Na estratégia por peso, ajuste o peso de cada um.
6. Defina "Ativa" ou "Pausada".
7. Clique em "Salvar".
8. Clique em "copiar para usar no Workflow".
9. Use o identificador na ação "Distribuir via regra".
10. Para editar ou excluir, use lápis ou lixeira.
<!-- screenshot: formulário de distribuição com estratégia e responsáveis -->

## Resultado esperado
"Regra salva" e "ID copiado".

## Regras e limites
Nome e ao menos um responsável são obrigatórios. Pesos só valem na estratégia por peso ("peso ignorado" nas demais). Pausar é diferente de excluir.

## Erros comuns
- "Dê um nome para a regra": preencha "Nome".
- "Adicione ao menos um responsável": inclua um membro.

## Relacionados
- [Criar e publicar workflows](/ajuda/crm/criar-publicar-workflows)
- [Permissões](/ajuda/crm/permissoes)
