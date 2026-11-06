---
module_key: ats
slug: buscar-perfis-linkedin
title: Buscar perfis no LinkedIn
summary: Pesquisar perfis e importar para o TechHire.
article_type: howto
route_pattern: /hunting/search
min_permission: 
audience: internal
sort_order: 42
version: 1
is_published: true
---
# Buscar perfis no LinkedIn
**Para que serve:** Encontrar candidatos fora do banco.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Hunting (LinkedIn) > Buscar perfis (`/hunting/search`).
**Antes de começar:** A conta LinkedIn precisa estar conectada.

## Passo a passo
1. Preencha "Palavras-chave", "Localização", "Empresa atual", "Setor" ou "Escola".
2. Em "Rede", escolha "1º", "2º" ou "3º+".
3. Clique em "Buscar". Use "Carregar mais" para ver outros.
4. Marque os perfis e clique em "Importar selecionados".
5. Acompanhe "Novos", "Já existiam", "Enriquecidos" e "Falhas".
<!-- screenshot: busca no LinkedIn -->

## Resultado esperado
"Importação concluída · N novos · N já existiam · N enriquecidos".

## Regras e limites
- 20 resultados por página.
- Perfis já existentes não são duplicados.
- Respeita janela de horário e limite diário.

## Erros comuns
- "Unipile não configurado": peça ao administrador.
- "Conta LinkedIn desconectada": reconecte a conta.
- "Budget diário atingido": tente amanhã.
- "Fora da janela horária": tente no horário permitido.

## Relacionados
- [Tratar candidatos capturados](/ajuda/ats/tratar-candidatos-capturados)
