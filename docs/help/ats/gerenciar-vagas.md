---
module_key: ats
slug: gerenciar-vagas
title: Gerenciar vagas
summary: Criar, filtrar e mover vagas entre status.
article_type: howto
route_pattern: /jobs
min_permission: techhire.jobs.view.own
audience: internal
sort_order: 22
version: 1
is_published: true
---
# Gerenciar vagas
**Para que serve:** Abrir e acompanhar as vagas.
**Quem pode fazer:** Quem vê vagas. Criar exige `techhire.jobs.create`. Publicar exige `techhire.jobs.publish.workspace`. Exportar exige `techhire.jobs.export.workspace`.
**Onde fica:** Menu > TechHire > Recrutamento > Vagas (`/jobs`).
**Antes de começar:** Tenha um pipeline de recrutamento.

## Passo a passo
1. Busque em "Buscar por título, departamento ou local…" ou filtre por "Pipeline".
2. Clique em "Nova vaga".
3. Preencha "Título *" e, se quiser, "Senioridade", "Vínculo", "Modalidade", "Localização", "Descrição", "Requisitos", "Status", "Pipeline" e "Negócio (opcional)".
4. Clique em "Criar vaga".
5. Para mudar o status, arraste a vaga ou use a alteração em lote.
<!-- screenshot: lista de vagas -->

## Resultado esperado
"Vaga criada".

## Regras e limites
- Status: Rascunho, Publicada, Em pausa, Preenchida, Encerrada.
- Título até 200; descrição até 20.000 caracteres.
- A lista mostra até 200 vagas.

## Erros comuns
- "Informe o título da vaga": preencha o título.
- "Falha ao mover vaga": confira sua permissão.

## Relacionados
- [Acompanhar uma vaga](/ajuda/ats/acompanhar-vaga)
- [Configurar pipelines](/ajuda/ats/configurar-pipelines)
