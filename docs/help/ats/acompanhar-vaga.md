---
module_key: ats
slug: acompanhar-vaga
title: Acompanhar uma vaga
summary: Gerir propriedades e candidaturas da vaga.
article_type: howto
route_pattern: /jobs/$id
min_permission: techhire.jobs.view.own
audience: internal
sort_order: 23
version: 3
is_published: true
---
# Acompanhar uma vaga
**Para que serve:** Mover candidatos pelas etapas e registrar a contratação.
**Quem pode fazer:** Quem vê a vaga. Adicionar candidato exige `techhire.candidates.create`. Exportar exige `techhire.jobs.export.workspace` e `techhire.candidates.export.workspace`.
**Onde fica:** Vagas > clique na vaga (`/jobs/$id`).
**Antes de começar:** Abra a vaga.

## Passo a passo
1. Clique em "Adicionar candidato", escolha em "Candidato" e clique em "Adicionar".
2. Mova as candidaturas entre as etapas.
3. Edite o painel "Propriedades".
4. Ao contratar, preencha "Registrar contratação": modelo "Interna", "Outsourcing" ou "Hunting".
5. Para exportar, clique em "CSV".
![Tela: detalhe da vaga](/help-media/ats/acompanhar-vaga.webp)

## Resultado esperado
"Candidato adicionado à vaga" ou "Contratação registrada".

## Regras e limites
- Etapas padrão: Aplicado, Triagem, Entrevista RH, Entrevista técnica, Teste, Proposta, Contratado, Rejeitado.
- Pipelines próprios podem ter outras etapas.

## Erros comuns
- "Sem permissão para confirmar contratação.": peça acesso.
- "Falha ao mover em massa": confira sua permissão.

## Relacionados
- [Gerenciar vagas](/ajuda/ats/gerenciar-vagas)

## Abrir uma candidatura ou entrevista por aviso

O link de **Inscrição em vaga recebida** seleciona **Pipeline** e confere a candidatura exata, mesmo que ela não esteja na lista ou no filtro carregado. **Entrevista marcada** seleciona **Entrevistas** e confere o agendamento exato. A leitura exige acesso à vaga e ao registro; entrevistas mantêm sua permissão própria.

Aguarde a conferência antes de agir. Falha, falta de permissão ou troca de workspace não mantém conteúdo antigo acionável. O link não move candidatura, contrata, agenda ou reagenda; não abre currículo, link de reunião ou convite público automaticamente. Inscrição exige um registro novo real; edição ou reabertura do mesmo registro não é outra inscrição. Entrevista marcada exige confirmação e data/hora futuras, não apenas convite pendente.
