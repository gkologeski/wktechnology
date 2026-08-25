# Corrigir gatilho, diagnóstico de erros e abertura da pesquisa de qualificação

## Diagnóstico confirmado

- O catálogo do builder remove `stage_id` como campo técnico. Porém, o workflow publicado usa exatamente `stage_id = qualifying`; por isso o seletor da condição não encontra a propriedade salva e aparece vazio.
- As duas execuções mostradas no card falharam em 14/08/2026 com `Ação não suportada`, no passo salvo como `create_survey_activity`. Nenhuma atividade foi criada; consequentemente, o polling do lead não encontrou uma pesquisa e não abriu o diálogo.
- A lista “Execuções recentes” já contém o erro e o log bruto, mas o card do workflow mostra apenas a contagem das últimas 24 horas e não oferece acesso direto ao detalhe.
- O motor atual identifica cada log pela ação, mas não persiste explicitamente a posição do passo. Para erros em fluxos aninhados, isso dificulta localizar onde a falha ocorreu.

## Implementação

### 1. Propriedades corretas no gatilho

- Expor a etapa do pipeline no catálogo de Leads como propriedade amigável “Etapa”, usando `stage_id` como valor real.
- Carregar as opções a partir das etapas configuradas no pipeline, com nome visível em vez de UUID.
- Preservar condições antigas que eventualmente usem `stage`, mas padronizar novas condições de Leads em `stage_id`.
- Garantir que uma condição já salva continue visível mesmo se um campo deixar de existir no catálogo, evitando seletor em branco.

### 2. Execuções com erro explicável

- Enriquecer cada item do log do motor com o caminho do passo no workflow (por exemplo, “Passo 1”, incluindo ramos aninhados) e o rótulo amigável da ação.
- No card que exibe “2 erro(s) hoje”, adicionar acesso ao detalhe das execuções filtrado para aquele workflow.
- Renderizar o histórico em formato legível: status em português, passo/ação, horário e mensagem do erro; manter detalhes técnicos recolhidos para inspeção.
- Exibir estados de carregamento, vazio e falha ao buscar as execuções.

### 3. Pesquisa criada e diálogo aberto

- Confirmar que `create_survey_activity` pertence ao dispatch executado em produção e adicionar teste de regressão do motor para essa ação.
- Ao criar a atividade, validar a origem escolhida e registrar no log o ID da atividade e o passo executado.
- Substituir a espera cega por uma busca imediata com retentativas curtas e mensagem discreta quando o workflow terminar sem criar a pesquisa; erros deixam de ser silenciosamente ignorados.
- Após a correção, reprocessar apenas o cenário de teste movendo um lead novamente para “Em qualificação”; não criar pesquisa retroativa para execuções que falharam.

## Detalhes técnicos

- Arquivos principais: catálogo de campos da entidade, editor de condições, motor de workflows, lista/card de execuções e detalhe do lead.
- Adicionar testes unitários para: catálogo da etapa de Leads, identificação do passo com erro e criação da atividade `survey` com metadados de origem.
- Não alterar score, questionários, RLS, autenticação ou regras de qualificação.
- Se a correção exigir alinhar o bundle publicado com o código atual do motor, publicar a versão corrigida é necessário para o cron executar a nova ação.

## Validação

1. Abrir o workflow e confirmar “Etapa” preenchida com “Em qualificação”, com demais propriedades disponíveis.
2. Abrir o detalhe das duas execuções antigas e confirmar que a interface mostra ação e mensagem `Ação não suportada`.
3. Mover um lead de outra etapa para “Em qualificação”.
4. Confirmar execução bem-sucedida, criação imediata da atividade de pesquisa e abertura automática do diálogo.
5. Responder a pesquisa e confirmar atualização da timeline e do score sem recarregar a página.
