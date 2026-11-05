---
module_key: ats
slug: acompanhar-observabilidade-hunting
title: Acompanhar a observabilidade do hunting
summary: Ver uso diário, sucesso e erros das chamadas ao LinkedIn.
article_type: howto
route_pattern: /hunting/observability
min_permission: 
audience: internal
sort_order: 44
version: 1
is_published: true
---
# Acompanhar a observabilidade do hunting
**Para que serve:** Evitar estourar os limites diários do LinkedIn.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Hunting (LinkedIn) > Observabilidade (`/hunting/observability`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Confira "Requisições · 24h", "Taxa de sucesso", "Latência média" e "Erros · 24h".
2. Em "Budgets diários por endpoint (UTC)", veja quanto já foi usado.
3. Clique em "Atualizar" para recarregar.
<!-- screenshot: observabilidade -->

## Resultado esperado
Os números das últimas 24 horas aparecem.

## Regras e limites
- Limites diários exibidos: busca 20, perfil 80, mensagens 40, convites 15.
- Mostra as últimas 100 requisições.
- Alerta a partir de 80% do limite.

## Erros comuns
- Muitos erros: confira a conexão da conta LinkedIn.

## Relacionados
- [Buscar perfis no LinkedIn](/ajuda/ats/buscar-perfis-linkedin)
