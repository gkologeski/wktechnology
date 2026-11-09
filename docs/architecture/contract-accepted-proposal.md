# Contrato de hunting vinculado à Proposta Comercial

O modelo revisado usa a Proposta Comercial aceita como documento comercial incorporado ao contrato. Nenhum texto gerado acrescenta nome do sistema interno, documento de ordem de serviço ou numeração de anexos.

| Variável do DOCX | Origem do preenchimento |
| --- | --- |
| `contract.number` | Número gerado para o contrato; o mesmo número é gravado na ficha e no corpo. |
| `counterparty.name` | Razão social da cliente preservada no envio da proposta. |
| `counterparty.cnpj` | CNPJ da cliente preservado no envio. |
| `counterparty.address` | Endereço da cliente preservado no envio. |
| `counterparty.city` | Cidade da cliente preservada no envio. |
| `counterparty.state` | UF da cliente preservada no envio. |
| `contracting.name` | Nome da pessoa jurídica prestadora selecionada para o contrato. |
| `contracting.cnpj` | CNPJ da prestadora selecionada. |
| `contracting.address` | Endereço em `legal_entities.address_json`, formatado como texto. |
| `proposal.id` | Identificador da proposta explicitamente selecionada. |
| `proposal.title` | Título da versão enviada e aceita. |
| `proposal.version` | Versão preservada no envio e posteriormente aceita pelo cliente. |
| `proposal.decided_at` | Data do aceite do cliente, em `pt-BR`, fuso `America/Sao_Paulo`. |

`contracting` é a pessoa jurídica emissora/prestadora (WK no modelo), e `counterparty` é a cliente. Os contatos do CRM não são tratados como signatários. O modelo não exige variáveis de início ou fim de vigência.

## Preservação e autorização

A migration `0334_contract_accepted_proposal` cria `proposal_document_versions`. O gatilho de envio preserva corpo, condições, itens comerciais e dados necessários da cliente. Campos dos itens são enumerados explicitamente; tokens privados e metadados internos não são copiados. Ficha, link público e PDF da proposta leem a mesma versão preservada.

`proposal_contract_source` usa o cliente autenticado e o RLS das propostas e das versões. Solicita apenas colunas permitidas, exige `accepted`, selo e data de resposta. Aprovação interna, rascunho ou envio não bastam. Não procura uma versão mais recente automaticamente.

Na criação do contrato, `contract_accepted_proposal_guard` revalida workspace, cliente, negócio e cotação. O banco grava a versão e a data do aceite em `contracts.metadata.accepted_proposal`; o navegador não fornece uma cópia confiável. Depois de vinculado, esse conteúdo e suas referências são imutáveis, inclusive por REST direto. Campos usados no modelo precisam estar preenchidos, e seus valores são escapados para HTML.

## Implantação e registros anteriores

1. Aplicar a migration antes de disponibilizar o novo código. Ela está registrada no journal Drizzle. Na base que já inclui o ciclo de vida de CNPJs (0314/0315), aplicar também `0335_legal_entity_usage_permission`, que protege a consulta direta de vínculos pela mesma autorização Finance da tela.
2. Importar/revisar/publicar o DOCX e conferir os 13 tokens no editor. O importador passa a reconhecer `proposal.*` pelo catálogo compartilhado.
3. Enviar a Proposta Comercial e obter o aceite do cliente. Gerar o contrato selecionando a proposta e a prestadora no diálogo ou assistente.
4. Publicar o conteúdo da Ajuda pelo fluxo editorial autorizado existente.

Não há reconstrução automática de histórico: propostas enviadas antes da migration não têm uma cópia verificável dos itens exibidos naquela data. Novos vínculos dessas propostas são bloqueados; é preciso criar uma nova proposta e obter novo aceite. Contratos anteriores não são reescritos e a conversão continua abrindo um contrato já existente.

Um rollback de interface deve manter as versões preservadas e sua leitura nos documentos. Não apagar `proposal_document_versions` nem retirar a proteção dos contratos vinculados como parte de um rollback rotineiro.

## Verificação

- `template-proposal.test.ts`: 13 variáveis, fontes reais do contexto, fuso, dados ausentes, origem conflitante, prestadora explícita e escape HTML.
- `accepted-proposal-postgres.test.ts`: funções/gatilhos SQL reais em PostgreSQL descartável, RLS, cinco cenários de acesso, coluna privada sem grant, preservação de itens e resistência à adulteração.
- `template-work-boundary.test.ts`: controles reais de importação/modelos antes da execução de handlers.
- Aceite adicional local com GoTrue e SDK/PostgREST: merge das 13 variáveis, gravação da mesma versão, tentativa de adulteração e quatro identidades negadas. Relatório local em `.verification/contract-proposal-jwt.json`, sem credenciais.
