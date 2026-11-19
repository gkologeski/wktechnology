---
name: text-busca-cria-empresa
description: "Implementar o campo text_Busca_Cria_Empresa: buscar, selecionar ou abrir cadastro oficial de empresa no TechERP/WK. Use ao criar ou corrigir esses campos no código, não para procurar registros de clientes no chat."
---
# text_Busca_Cria_Empresa

Implemente um campo de busca com cadastro explícito, mantendo o White Label e o rascunho da tela de origem. O nome exibido solicitado é `text_Busca_Cria_Empresa`; o ID técnico de invocação é `$text-busca-cria-empresa`.

## Componentes e contrato
- Base compartilhada: `src/components/ui/search-create-field.tsx` (`SearchCreateField`). Ela só recebe opções, estado e callbacks; não é uma autorização nem acessa banco.
- Abertura do cadastro oficial: `src/components/record/search-create-record-dialog.tsx`, `entity="company"`. Preserve o ator/workspace capturados ao abrir e as permissões efetivas. O fluxo existente usa CompanyPicker e QuickCreateCompanyDialog.
- Exemplo integrado: `src/components/hiring-requests/preparation-reference-field.tsx`. Fora de solicitações, forneça o carregador autorizado do recurso correto; não reutilize a API de preparação como um acesso genérico ao banco.
- O valor vinculado é um ID canônico da entidade `companies`. Nome digitado é busca, não prova de cadastro. “Criar” abre o formulário, nunca grava automaticamente; fechar ou cancelar mantém o rascunho pai e não seleciona um ID inexistente.

## Leitura e criação
- Faça buscas limitadas, com debounce, e descarte respostas obsoletas. Separe cache por usuário, workspace, contexto e permissões relevantes. Mostre falha e nova tentativa; falha não significa “nenhum cadastro”.
- A criação só aparece com permissão efetiva do recurso, contexto ativo e sem leitura apenas. A operação usa o gravador canônico autenticado/RLS; não acrescente service client, grant, fallback sem permissão ou endpoint genérico de insert.
- Depois de criar, releia o ID no mesmo workspace e com os mesmos filtros de tipo/empresa antes de selecionar. Respeite mudança de ator/workspace durante a operação. Não navegue para fora nem apague o formulário pai ao retornar.
- Preserve busca existente e vínculos históricos; não execute uma migração em massa dos registros por causa da adoção visual.

- Em um Dialog com sugestões inline, impeça o fechamento pelo Escape enquanto o combobox estiver expandido; o exemplo de preparação preserva o rascunho e fecha primeiro as sugestões.

## Particularidades
- No cadastro de lead/contato, o padrão existente é `src/components/ui/company-picker.tsx` com `QuickCreateCompanyDialog`. Para campos de FK, texto digitado não substitui `company_id`; selecione um ID real ou conclua a criação.
- Empresas com o mesmo nome não são necessariamente a mesma pessoa jurídica. Use CNPJ/domínio como contexto autorizado e deixe ambiguidades para escolha humana; não vincule pelo primeiro resultado.
- Em solicitações, use o carregador autenticado do contexto; a exceção legada `rep_find_companies` não autoriza consultar ou vincular qualquer empresa fora do escopo de leitura exigido pelo destino.


## Validação útil
Confira seleção de registro existente, criação confirmada e retorno do ID, cancelamento, consulta com erro, teclado e ator/workspace trocado. Teste acesso permitido, sem chave, deny, outro workspace e inativo na fronteira que efetivamente grava; testes só da UI não substituem RLS/RPC. Reutilize os testes do controle e dos gravadores existentes, sem cópias que apenas reflitam a implementação.
