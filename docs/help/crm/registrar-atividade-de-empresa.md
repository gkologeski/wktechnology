---
module_key: crm
slug: registrar-atividade-de-empresa
title: Registrar atividade de empresa
summary: Registrar atividade de empresa.
article_type: howto
route_pattern: /companies/$id
min_permission:
audience: internal
sort_order: 129
version: 1
is_published: true
---
# Registrar atividade de empresa
**Para que serve:** Registrar atividade de empresa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Notas exigem view e create de `techsales.notes`; tarefas, de `techsales.tasks`; demais registros, de `techsales.activities`, nos escopos own, team ou workspace. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra a ficha.
2. Na barra da timeline, clique em "Nota" ou "Tarefa". Use "Mais" para outras ações disponíveis.
3. Preencha o conteúdo. Para tarefa, revise prazo e responsável.
4. Clique em "Salvar Nota" ou "Salvar Tarefa", conforme a ação.
<!-- screenshot: Registrar atividade de empresa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A atividade é registrada e a timeline é atualizada.
## Regras e limites
Registrar uma comunicação não é enviá-la. As ações disponíveis dependem das permissões e dos canais configurados.
## Erros comuns
Mensagens de falha são retornadas pelo serviço. Corrija os dados indicados antes de tentar novamente.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)
