---
module_key: ats
slug: tratar-candidatos-capturados
title: Tratar candidatos capturados
summary: Enriquecer capturas com IA e definir responsável.
article_type: howto
route_pattern: /hunting/captures
min_permission: 
audience: internal
sort_order: 41
version: 1
is_published: true
---
# Tratar candidatos capturados
**Para que serve:** Completar e distribuir os perfis capturados.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace. Mudar o responsável exige permissão sobre os candidatos.
**Onde fica:** Menu > TechHire > Hunting (LinkedIn) > Capturados (`/hunting/captures`).
**Antes de começar:** Tenha capturas recentes.

## Passo a passo
1. Filtre por "Responsável", se quiser.
2. Marque as linhas ou "Selecionar todos".
3. Clique em "Enriquecer com IA (n)".
4. Para distribuir, use "Definir responsável" e escolha um membro ou "Sem responsável".
<!-- screenshot: candidatos capturados -->

## Resultado esperado
Aparece "Enriquecidos: N · falhas: N" ou "Responsável atualizado em N candidato(s).".

## Regras e limites
- Mostra as 100 capturas mais recentes.
- Enriquece até 20 por vez.
- Define responsável para até 200 por vez, sem confirmação.

## Erros comuns
- "Você não tem permissão para alterar o responsável destes candidatos.": peça acesso.
- "Captura e candidato pertencem a empresas diferentes.": a captura é de outro workspace.

## Relacionados
- [Usar o hub de hunting](/ajuda/ats/usar-hub-de-hunting)
