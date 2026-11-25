---
module_key: core
slug: manter-empresas-e-cnpjs-do-workspace
title: Manter empresas e CNPJs do workspace
summary: Manter empresas e CNPJs do workspace.
article_type: howto
route_pattern: /settings/legal-entities
min_permission: system.legal_entities.view.workspace
audience: internal
sort_order: 138
version: 4
is_published: true
---
# Manter empresas e CNPJs do workspace

**Para que serve:** Manter empresas e CNPJs do workspace, no contexto da tela `/settings/legal-entities`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/legal-entities`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > Empresas (CNPJs).
2. Busque por nome, código ou CNPJ e filtre Todas, Ativas ou Inativas.
3. Use Nova empresa ou Editar para revisar razão social, nome fantasia, CNPJ, IE e IM; salve.
4. Para desativar, use o ícone de energia e confirme: nenhum lançamento ou histórico é apagado.
5. Para reativar, use o mesmo controle na empresa inativa.
6. Para excluir, use a lixeira: o sistema confere todos os vínculos e recusa a exclusão quando há registros. Nesse caso, escolha desativar.
7. Antes de desativar ou excluir a empresa padrão, defina outra empresa ativa como padrão.
8. Na edição, use **Buscar dados do CNPJ** com um CNPJ válido para consultar razão social, nome fantasia e endereço na BrasilAPI (alternativa: ReceitaWS). Confirme a substituição de dados existentes e revise antes de salvar; a consulta não grava automaticamente.
9. Preencha **Endereço da empresa**: CEP, logradouro, número, complemento, bairro, cidade e UF. O CEP completo consulta ViaCEP ao sair do campo; o botão ao lado permite tentar novamente. Número e complemento não são alterados por CEP; dados ausentes na consulta são mantidos.
10. Salve, volte à minuta e clique em **Preencher dados da proposta** para usar o endereço da prestadora. Nome e CPF do signatário continuam vindo do cadastro do representante legal.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Cadastro compartilhado de pessoas jurídicas com componente da área financeira; não é a lista de empresas do CRM nem uma lista de workspaces.
- Novos vínculos aceitam somente empresas ativas do mesmo workspace; filtros históricos continuam mostrando as inativas.
- Negócios, cotações, propostas, contratos, serviços, projetos, pessoas, vagas, assinaturas e recorrências herdam o CNPJ da origem ou o padrão quando não informado.
- Vínculos previamente preenchidos são preservados. A alteração não muda valores financeiros.
- Leads, contatos e empresas da carteira têm contexto por seus negócios; não recebem um CNPJ próprio nesta entrega.
- Consulta por CNPJ/CEP exige autorização de criação/edição sobre a empresa, usando o mesmo controle financeiro do cadastro; membership ativo, workspace e deny são preservados. A consulta envia somente CNPJ ou CEP aos serviços públicos, nunca documentos contratuais ou credenciais.
- Não altera contratos assinados nem recalcula valores. Serviços externos indisponíveis não impedem preenchimento manual.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/legal-entities com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/manter-empresas-e-cnpjs-do-workspace.webp)
