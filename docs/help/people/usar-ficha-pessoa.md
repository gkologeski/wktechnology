---
module_key: people
slug: usar-ficha-pessoa
title: Usar a ficha da pessoa
summary: Editar o perfil e usar as abas de alocações, horas, metas, documentos e mais.
article_type: howto
route_pattern: /people/$id
min_permission: techpeople.people.view.own
audience: internal
sort_order: 11
version: 1
is_published: true
---
# Usar a ficha da pessoa
**Para que serve:** Ver e manter tudo sobre uma pessoa em um só lugar.
**Quem pode fazer:** Quem pode ver a pessoa. Cada aba exige a permissão de ver do seu recurso. Editar depende do registro.
**Onde fica:** TechPeople > Pessoas > clique no nome ou em "Abrir" (`/people/$id`).
**Antes de começar:** A pessoa precisa estar cadastrada.

## Passo a passo
1. Na aba "Perfil", altere "Dados básicos", "Dados pessoa jurídica" e "Notas internas".
2. "Financeiro (restrito)" só aparece para quem vê dados sensíveis.
3. Clique em "Salvar". 
## Resultado esperado
"Ficha atualizada". Cada aba confirma o que foi salvo, por exemplo "Alocação criada" ou "Documento adicionado".

## Abas
| Aba | Permissão para ver | O que faz |
|---|---|---|
| Alocações | `techpeople.allocations` | "Nova alocação": contrato, projeto, gestor, %, período e taxas |
| Timesheet | `techpeople.timesheet` | "Lançar horas", filtros, "Aprovar", "Remover aprovação", CSV |
| Metas | `techpeople.goals` | "Nova meta": KPI, OKR ou Entrega |
| 1:1s | `techpeople.one_on_ones` | "Nova 1:1" com pauta, notas e itens de ação |
| Avaliações | `techpeople.reviews` | "Nova avaliação do tomador" por período |
| Onboarding | `techpeople.onboarding` ou `.offboarding` | "Novo plano" de admissão ou desligamento e suas tarefas |
| Psicossocial | `techpeople.wellbeing.assessments` | "Nova avaliação psicossocial" |
| Incidentes | `techpeople.incidents` | "Novo incidente" |
| Benefícios | `techpeople.benefits` | "Novo benefício" |
| Documentos | `techpeople.documents` | "Novo documento", "Visualizar", "Baixar" |
| Histórico | `techpeople.events` | Últimos 50 eventos |

## Regras e limites
- Horas por lançamento: de 0 a 24.
- Documento: até 20 MB (PDF, imagem ou Word). Alerta 30 dias antes da validade.
- Na aba "Alocações", o painel "Contratação integrada e acessos" exige `techpeople.employment.view` (ver) e `.manage` (gerir). "Preparar convite de acesso" gera um link; o envio não é automático.
- Encerrar vínculo e revisar modelo de acesso pedem motivo com pelo menos 10 caracteres.

## Erros comuns
- "Pessoa indisponível ou sem acesso.": você não pode ver essa pessoa.
- "Arquivo maior que 20 MB": reduza o arquivo.
- Aba não aparece: falta a permissão daquele recurso.

## Relacionados
- [Cadastrar e gerenciar pessoas](/ajuda/people/gerenciar-pessoas)
- [Acompanhar onboarding](/ajuda/people/acompanhar-onboarding)
