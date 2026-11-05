---
module_key: ats
slug: gerenciar-candidatos
title: Gerenciar candidatos
summary: Listar, filtrar, cadastrar, importar e exportar candidatos.
article_type: howto
route_pattern: /candidates
min_permission: techhire.candidates.view.own
audience: internal
sort_order: 20
version: 1
is_published: true
---
# Gerenciar candidatos
**Para que serve:** Manter o banco de talentos.
**Quem pode fazer:** Quem tem `techhire.candidates.view` (own, team ou workspace). Criar exige `techhire.candidates.create`. Exportar exige `techhire.candidates.export.workspace`. Excluir depende da permissão sobre o registro.
**Onde fica:** Menu > TechHire > Recrutamento > Candidatos (`/candidates`).
**Antes de começar:** Tenha o nome do candidato. Para importar, tenha a URL do LinkedIn ou o currículo.

## Passo a passo
1. Use a busca "Buscar por nome, email, cargo ou skill…" e escolha a visualização (cartões, tabela ou kanban).
2. Clique em "Novo candidato".
3. Em "Como deseja cadastrar o candidato?", escolha "Preencher manualmente", "Importar do LinkedIn" ou "Extrair de um CV (PDF)".
4. Manual: preencha "Nome *" e os demais campos e salve.
5. LinkedIn: informe "URL do perfil no LinkedIn" e clique em "Buscar perfil". Revise e salve.
6. CV: anexe o PDF ou use "Cole o texto do currículo" e clique em "Extrair e salvar".
7. Para exportar, clique em "CSV".
<!-- screenshot: lista de candidatos -->

## Resultado esperado
"Candidato salvo" ou "Candidato criado a partir do CV".

## Regras e limites
- Nome é obrigatório (até 200 caracteres).
- A URL do LinkedIn precisa ter /in/.
- Texto do CV: de 40 a 20.000 caracteres; PDF até 15 MB.
- A lista mostra até 300; o CSV exporta até 5.000.
- No kanban, só é possível mover para "Em processo" um candidato associado a uma vaga.
- Excluir pede confirmação: "Excluir este candidato?".

## Erros comuns
- "Informe o nome": preencha o nome.
- "URL inválida. Use o formato https://linkedin.com/in/usuario": corrija a URL.
- "Envie um PDF ou cole o texto do currículo (mínimo 40 caracteres)": complete o currículo.

## Relacionados
- [Editar a ficha do candidato](/ajuda/ats/editar-ficha-candidato)
- [Buscar perfis no LinkedIn](/ajuda/ats/buscar-perfis-linkedin)
