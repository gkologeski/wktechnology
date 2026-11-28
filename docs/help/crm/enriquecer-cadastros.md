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
version: 5
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
![Tela: janela Enriquecer na lista de leads](/help-media/crm/enriquecer-cadastros.webp)

## Preencher só celulares via Apollo
Em Contatos, abra **Celulares via Apollo**. A prévia especial não chama a Apollo.
Ela conta cadastros visíveis sem celular, com cargo de gestão de TI, vínculo a uma
empresa cujo cadastro confirma pelo menos 100 funcionários e perfil LinkedIn ou
e-mail corporativo identificável. Uma faixa que cruza 100 não comprova o porte.
Registros sem porte confiável ficam fora.

Só confirme a consulta paga após revisar o máximo indicado. A operação reserva
até 9 créditos por tentativa no Apollo padrão; não usa terceiros nem consulta
e-mail pessoal. O saldo reservado é um teto, não o gasto medido pelo Apollo.
Use **Recuperar resultados (0 créditos)** para buscar as respostas prontas. A
rotina só grava um celular inequivocamente identificado no cadastro existente e
não troca nenhum número preenchido. Se uma consulta falhar sem confirmação, a
reserva permanece e a chamada não é repetida. Operação única, de até 5.000
créditos, liberada somente no workspace autorizado.

## Resultado esperado
Os campos são preenchidos conforme o modo escolhido. Telefones pedidos ao Apollo podem chegar alguns minutos depois.

## Regras e limites
- Até 500 registros por chamada; seleções maiores são divididas em lotes de 500.
- Campos de Lead: e-mail, telefone, nome, sobrenome, empresa, cargo e LinkedIn. Contato: os mesmos, sem empresa.
- Os provedores rodam em cascata, na ordem escolhida.
- Foto colocada manualmente nunca é trocada.
- Conta-se um crédito por retorno encontrado de cada provedor, mesmo sem mudança de campo.
- A simulação não grava mudanças nem créditos, mas ainda consulta os provedores.
- CNPJ: usa BrasilAPI e, se falhar, ReceitaWS. Aceita 14 dígitos válidos ou 13 dígitos com zero à esquerda omitido quando o preenchimento com `0` forma um CNPJ válido (corrigindo o CNPJ armazenado para 14 dígitos), preenche **Razão social** e **Nome fantasia** separadamente (além de setor, porte, telefone, endereço, cidade, estado, CEP e domínio) e nunca sobrescreve o campo **Nome**. Na ficha da empresa, quando já existir valor diferente, o sistema pede confirmação antes de substituir.

## Erros comuns
- "Apollo não conectado: configure APOLLO_API_KEY em Integrações.": conecte o Apollo.
- "Lusha não conectado: configure LUSHA_API_KEY em Integrações.": conecte o Lusha.
- "Créditos do Apollo.io esgotados. Atualize o plano para voltar a enriquecer.": renove os créditos.
- "Cadastre o CNPJ antes de enriquecer.": informe o CNPJ.
- "CNPJ inválido. Confira os dígitos informados.": verifique os dígitos verificadores do CNPJ.
- "CNPJ não encontrado nas bases públicas.": confirmado quando BrasilAPI e ReceitaWS informam que o CNPJ não existe; confira o número.
- "O serviço público de consulta de CNPJ (BrasilAPI/ReceitaWS) atingiu o limite temporário de requisições. Tente novamente em instantes.": limite temporário das APIs públicas; aguarde alguns instantes e tente de novo.
- "O serviço público de consulta de CNPJ (BrasilAPI/ReceitaWS) está temporariamente instável. Tente novamente em instantes.": indisponibilidade temporária das APIs públicas; tente novamente em instantes.

## Relacionados
- [Visão geral do TechSales](/ajuda/crm)
