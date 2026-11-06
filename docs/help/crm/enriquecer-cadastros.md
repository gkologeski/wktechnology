---
module_key: crm
slug: enriquecer-cadastros
title: Enriquecer contatos, leads e empresas
summary: Completar dados de cadastros com Apollo, Lusha e consulta de CNPJ.
article_type: howto
route_pattern: /settings/enrichment
min_permission: techsales.prospecting_enrichment.view.own
audience: internal
sort_order: 161
version: 1
is_published: true
---
# Enriquecer contatos, leads e empresas
**Para que serve:** Preencher e-mail, telefone, nome, cargo, empresa e LinkedIn com dados de provedores externos.
**Quem pode fazer:** Executar exige `techsales.prospecting_enrichment.manage.own/team/workspace`. Consultar o histórico exige `.view`. Em lote, cada registro também precisa poder ser alterado (ou visto, na simulação).
**Onde fica:** Listas de Contatos (`/contacts`) e Leads (`/leads`) > selecione registros > "Enriquecer". Ficha da empresa (`/companies/$id`) > "Enriquecer via CNPJ". Ficha do Lead, ao trocar o LinkedIn.
**Antes de começar:** Conecte Apollo ou Lusha nas integrações. Para empresas, cadastre o CNPJ.

## Passo a passo
1. Na lista de Contatos ou Leads, selecione os registros e clique em "Enriquecer".
2. Em "Provedores (na ordem)", escolha Apollo, Lusha ou os dois.
3. Em "Modo", escolha "Preencher apenas vazios" ou "Sobrescrever existentes".
4. Em "Execução", escolha "Aplicar mudanças" ou "Simular (sem consumir crédito)".
5. Confirme e acompanhe o resumo: atualizados, sem mudanças, falhas e créditos.
6. Para empresa, abra a ficha e clique em "Enriquecer via CNPJ".
7. No Lead, salve uma nova URL de LinkedIn. O sistema reenriquece sozinho.
<!-- screenshot: janela Enriquecer na lista de leads -->

## Resultado esperado
Os campos são preenchidos conforme o modo escolhido. Telefones pedidos ao Apollo podem chegar alguns minutos depois.

## Regras e limites
- Até 500 registros por chamada; seleções maiores são divididas em lotes de 500.
- Campos de Lead: e-mail, telefone, nome, sobrenome, empresa, cargo e LinkedIn. Contato: os mesmos, sem empresa.
- Os provedores rodam em cascata, na ordem escolhida.
- Foto colocada manualmente nunca é trocada.
- Conta-se um crédito por retorno encontrado de cada provedor, mesmo sem mudança de campo.
- A simulação não grava mudanças nem créditos, mas ainda consulta os provedores.
- CNPJ: usa BrasilAPI e, se falhar, ReceitaWS. Exige 14 dígitos e só preenche campos vazios (nome, setor, porte, telefone, endereço, cidade, estado, CEP e domínio).

## Erros comuns
- "Apollo não conectado: configure APOLLO_API_KEY em Integrações.": conecte o Apollo.
- "Lusha não conectado: configure LUSHA_API_KEY em Integrações.": conecte o Lusha.
- "Créditos do Apollo.io esgotados. Atualize o plano para voltar a enriquecer.": renove os créditos.
- "Cadastre o CNPJ antes de enriquecer.": informe o CNPJ.
- "CNPJ não encontrado nas bases públicas.": confira o número.

## Relacionados
- [Visão geral do TechSales](/ajuda/crm)
