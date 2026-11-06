---
module_key: ats
slug: acompanhar-multi-posting
title: Acompanhar o multi-posting
summary: Ver e gerenciar a publicação de vagas em sites externos.
article_type: howto
route_pattern: /sourcing/multi-posting
min_permission: techhire.jobs.view.own
audience: internal
sort_order: 66
version: 2
is_published: true
---
# Acompanhar o multi-posting
**Para que serve:** Distribuir vagas em job boards.
**Quem pode fazer:** Ver exige `techhire.jobs.view`. Republicar e encerrar exigem `techhire.jobs.publish.workspace` e permissão sobre a vaga.
**Onde fica:** Menu > TechHire > Sourcing > Multi-posting (`/sourcing/multi-posting`).
**Antes de começar:** Tenha vagas publicadas.

## Passo a passo
1. Filtre por site ("LinkedIn Jobs", "Indeed", "Vagas.com") e status.
2. Use "Abrir", "Republicar" ou "Encerrar".
<!-- screenshot: multi-posting -->

## Resultado esperado
"Publicação atualizada" ou "Publicação encerrada".

## Regras e limites
- O modo depende do provedor. LinkedIn possui caminho de publicação real quando há conta conectada e configuração válida. Indeed e Vagas.com ainda retornam publicações simuladas no código atual. Nesses dois sites, o status ou a ausência do selo de simulação não comprova publicação; confira o destino externo.
- Mostra até 200 publicações.

## Erros comuns
- "Registro indisponível ou sem permissão para esta ação.": peça acesso.

## Relacionados
- [Gerenciar vagas](/ajuda/ats/gerenciar-vagas)
