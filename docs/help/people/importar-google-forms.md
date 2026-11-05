---
module_key: people
slug: importar-google-forms
title: Importar prestadores do Google Forms
summary: Cadastrar pessoas e anexos a partir da planilha de respostas.
article_type: howto
route_pattern: /people/import-forms
min_permission: techpeople.people.create.own
audience: internal
sort_order: 13
version: 1
is_published: true
---
# Importar prestadores do Google Forms
**Para que serve:** Trazer respostas de um formulário para o cadastro de pessoas, com anexos.
**Quem pode fazer:** O servidor exige todas estas, no escopo workspace: `techpeople.people.view`, `.create` e `.update`; `techpeople.people_sensitive.view` e `.update`; `techpeople.documents.view` e `.create`.
**Onde fica:** Menu > TechPeople > Pessoas > Importar do Google Forms (`/people/import-forms`).
**Antes de começar:** Deixe a planilha e a pasta de anexos como "Qualquer pessoa com o link — Leitor".

## Passo a passo
1. Cole a "URL da planilha".
2. Clique em "Simular". Nada é gravado.
3. Confira "Pessoas únicas" e a prévia.
4. Clique em "Executar importação" e confirme.
5. Acompanhe "Progresso": criadas, atualizadas, sem alteração e anexos.
<!-- screenshot: importar forms -->

## Resultado esperado
"Importação concluída". As pessoas recebem a tag `form-import`.

## Regras e limites
- A chave é o CPF. Se a pessoa existe, só os campos vazios são completados. Reexecutar é seguro.
- Com CPF repetido na planilha, vale a primeira linha.
- Anexos quebrados (.bin): use "Reimportar anexos .bin" (exige `techpeople.documents.update`).
- Não há botão para cancelar no meio.

## Erros comuns
- "URL da planilha inválida": confira o link.
- "Falha ao baixar planilha": torne a planilha pública com link.
- "Sem permissão para importar dados privados de todas as pessoas selecionadas.": falta acesso a dados sensíveis.

## Relacionados
- [Cadastrar e gerenciar pessoas](/ajuda/people/gerenciar-pessoas)
