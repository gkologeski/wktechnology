---
module_key: ats
slug: revisar-flags-de-risco
title: Revisar flags de risco
summary: Encontrar duplicatas, CVs suspeitos e sinais de fraude.
article_type: howto
route_pattern: /fraud-flags
min_permission: 
audience: internal
sort_order: 13
version: 1
is_published: true
---
# Revisar flags de risco
**Para que serve:** Evitar cadastros duplicados ou suspeitos.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Inteligência (IA) > Flags de risco (`/fraud-flags`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Clique em "Rodar scan agora".
2. Revise as colunas "Candidato", "Tipo", "Severidade" e "Status".
3. Depois de tratar, clique em "Marcar resolvido".
<!-- screenshot: flags de risco -->

## Resultado esperado
O status passa de "Aberto" para "Resolvido".

## Regras e limites
- O scan analisa até 2.000 candidatos.
- A lista mostra até 500 flags.
- Uma flag é um alerta, não uma conclusão.

## Erros comuns
- "Sem flags. Rode um scan.": ainda não houve análise.

## Relacionados
- [Gerenciar candidatos](/ajuda/ats/gerenciar-candidatos)
