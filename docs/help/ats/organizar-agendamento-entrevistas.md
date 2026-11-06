---
module_key: ats
slug: organizar-agendamento-entrevistas
title: Organizar o agendamento de entrevistas
summary: Pools de entrevistadores, disponibilidade e horários em comum.
article_type: howto
route_pattern: /scheduling
min_permission: techhire.interviews.view.own
audience: internal
sort_order: 32
version: 1
is_published: true
---
# Organizar o agendamento de entrevistas
**Para que serve:** Distribuir entrevistas e achar horários.
**Quem pode fazer:** Quem tem acesso a entrevistas ou pools. Criar pool exige `techhire.interviewer_pools.create`.
**Onde fica:** Menu > TechHire > Recrutamento > Scheduling (`/scheduling`).
**Antes de começar:** Cadastre os entrevistadores.

## Passo a passo
1. Em "Pools de entrevistadores", preencha "Nome da pool" e "Estratégia" ("Round-robin" ou "Balanceada (por carga)") e clique em "Criar pool".
2. Use "Adicionar membro…" e "Atribuir próximo".
3. Em "Disponibilidade semanal", clique em "Nova janela" e informe "Entrevistador", "Dia", "Início" e "Fim".
4. Em "Encontrar slots em comum", escolha os entrevistadores, "De", "Até", "Duração (min)" e "Passo (min)".
<!-- screenshot: scheduling -->

## Resultado esperado
"Pool criada" ou "Janela adicionada".

## Regras e limites
- Busca de 1 a 8 entrevistadores.
- Duração de 15 a 240 minutos.
- O fim precisa ser depois do início.

## Erros comuns
- "Escolha um entrevistador": selecione alguém.
- "Fim deve ser após início": corrija o horário.
- "Nenhum slot em comum encontrado": amplie o período.

## Relacionados
- [Gerenciar kits de entrevista](/ajuda/ats/gerenciar-kits-entrevista)
