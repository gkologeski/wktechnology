---
module_key: ats
slug: gerenciar-templates-hunting
title: Gerenciar templates de hunting
summary: Criar mensagens do LinkedIn com variáveis.
article_type: howto
route_pattern: /hunting/templates
min_permission: 
audience: internal
sort_order: 43
version: 1
is_published: true
---
# Gerenciar templates de hunting
**Para que serve:** Padronizar a primeira abordagem.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Menu > TechHire > Hunting (LinkedIn) > Templates (`/hunting/templates`).
**Antes de começar:** Prepare o texto.

## Passo a passo
1. Clique em "Novo template".
2. Preencha "Nome" e escolha "Canal": "Mensagem direta", "InMail" ou "Pedido de conexão".
3. No InMail, preencha "Assunto (InMail)", se quiser.
4. Escreva a "Mensagem" com variáveis como {{primeiro_nome}}.
5. Clique em "Salvar".
6. Para remover, use a lixeira e confirme.
<!-- screenshot: templates de hunting -->

## Resultado esperado
"Template salvo".

## Regras e limites
- Nome até 120 e mensagem até 8.000 caracteres.
- Referência: InMail ~1.900 e convite 300 caracteres.
- Variáveis: {{nome}}, {{primeiro_nome}}, {{empresa_atual}}, {{cargo_atual}}, {{localizacao}}, {{vaga}}, {{vaga_local}}.

## Erros comuns
- "Você não tem permissão para excluir este modelo de hunting.": peça ao dono ou admin.

## Relacionados
- [Buscar perfis no LinkedIn](/ajuda/ats/buscar-perfis-linkedin)
