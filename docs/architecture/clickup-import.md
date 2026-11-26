# Importação ClickUp → TechProjects

Entrada principal: `/projects/settings/imports` (TechProjects → Importações). A rota específica `/projects/settings/imports/clickup` permanece como configuração/revisão avançada compatível.

## Jornada e preservação

1. Confirmar a conexão deste workspace e escolher explicitamente as organizações da origem que lhe pertencem.
2. Conferir a cobertura disponível, incluindo histórico, ativos, arquivados, pessoas e entidades relacionadas.
3. Receber e preservar os registros antes de normalizar sua representação operacional. Uma falha mantém o que já foi recebido e o checkpoint permite continuar.
4. Consultar todos os registros e resolver pendências, sem excluir lançamentos para terminar.

Não existem mais exclusões por nome de organização ou retenção automática de listas novas. A escolha de quais organizações pertencem ao workspace continua explícita. A coleta usa apenas GET na API oficial; não altera o ClickUp.

`clickup_import_runs.collect_cursor` registra uma unidade curta por vez. O cursor do navegador não é autoridade. A revisão numérica do checkpoint recusa gravação concorrente desatualizada. Erros de acesso, capacidades ou conteúdo são lacunas de cobertura; `done` indica processamento das unidades e não comprova cobertura integral se houver lacunas. Agendas retornam `collection_incomplete` nesse caso.

## Conexão e autorização

- `techprojects.clickup_import.view.workspace`: consultar fontes já configuradas, evidências e resultado.
- `techprojects.clickup_import.manage.workspace`: configurar conexão/origens, iniciar e retomar coleta, decidir vínculos e aplicar/desfazer por RPCs canônicas.
- Membership ativo e deny prevalecem. Nenhuma chave é concedida automaticamente. Manage conserva sua semântica anterior; o fluxo somente leitura não pode gravar ou iniciar GETs de importação.
- Credenciais novas ficam cifradas em `clickup_import_connections`, sempre por workspace, e não voltam ao cliente. O formulário verifica a chave com GET oficial antes de salvá-la; trocar a chave exige confirmar novamente as organizações.
- A chave global antiga só funciona para marcadores privados semeados na migração para workspaces com importação aplicada e vínculo real de tarefa anterior. Um novo tenant, mesmo com manage próprio, não pode listar ou importar organizações usando a chave global. Navegadores não podem ler a coluna cifrada nem forjar o marcador.
- Leituras de evidências e arquivos são limitadas ao workspace ativo. Serviços derivam/revalidam o ator da execução nativa e reconferem as organizações autorizadas.

## Cobertura ClickUp

- Organizações autorizadas, participantes, espaços, pastas e listas (ativos e arquivados), tarefas, concluídas e subtarefas.
- Tarefas em múltiplas listas preservam todas as relações. A aplicação usa somente a lista principal declarada pelo ClickUp, nunca a última lista lida. Lista principal ausente ou fora da cobertura vira pendência; não se inventa projeto.
- Uma tarefa tem uma identidade no catálogo. Listagem e detalhe são conservados em `_source_observations.lists` e `.detail`; o resumo não substitui o detalhe completo em reimportações. A primeira expansão da observação pode criar versão sem fingir alteração posterior na origem.
- Comentários de tarefas são percorridos com data e ID; respostas são lidas pelo endpoint próprio.
- Horas e seu histórico são preservados como evidência de origem própria, incluindo duração inválida, pontos abertos e ajustes. A consulta inclui participantes atuais e históricos identificáveis nas tarefas. Não soma automaticamente essas horas às do Clockify/Jibble nem aprova ou cobra.
- Os filtros de datas tentam a faixa integral representável, incluindo antes de 1970 e datas futuras. Se a API recusar, a coleta tenta faixas menores, registra lacuna e não declara integralidade após fallback.
- Documentos ativos/arquivados/excluídos acessíveis e todas as páginas/subpáginas disponíveis em Markdown e metadados.
- Anexos: metadados são preservados antes da transferência. Uma unidade transfere no máximo um arquivo; conteúdo vai para bucket privado e só abre por URL autorizada de 60 segundos. A credencial da API nunca acompanha o download no CDN.

Limitações da origem permanecem explícitas: a API de Docs não exporta todos os estilos, capas, comentários e elementos incorporados do produto; tarefas excluídas e versões anteriores que os endpoints não oferecem não podem ser recuperadas por inferência. Arquivo acima de 64 MiB, host fora do CDN permitido ou acesso negado fica com conteúdo pendente e impede cobertura integral. Essas situações não descartam seus metadados.

## Aplicação e dados anteriores

A aplicação continua pelas RPCs `clickup_import_apply_step` e `clickup_import_sync_assignees`, sem disparar workflows. Os vínculos por ID impedem tarefas duplicadas entre execuções. Reimportar conserva edições do TechERP; alterações da origem permanecem em versões e pendências para conferência.

Pessoas históricas não recebem acesso. Vínculos precisam de correspondência exata ou confirmação humana, respeitando o workspace. Nome ambíguo não escolhe arbitrariamente um projeto. Vínculos confirmados em `clickup_import_list_targets` são reaproveitados para novas representações sem mover tarefas que alguém já editou.

Snapshots antigos normalizados continuam preservados como evidência legada. Não são rotulados como original completo recuperado. A releitura da API pode complementar os campos que ainda existem na origem.

O desfazer avançado remove apenas dados criados pela execução que não tenham sido editados/usados, conservando o histórico de origem e os dados reais protegidos pelos critérios existentes. Importar não equivale a aprovar horas, pagar fornecedores ou faturar clientes.

## Referências primárias

- [Tarefas e participação em múltiplas listas](https://developer.clickup.com/reference/gettasks).
- [Paginação de comentários](https://developer.clickup.com/docs/task-comments-pagination).
- [Respostas de comentários](https://developer.clickup.com/reference/getthreadedcomments).
- [Histórico de horas e filtros por participante](https://developer.clickup.com/reference/gettimeentrieswithinadaterange).
- [Catálogo de documentos](https://developer.clickup.com/reference/searchdocspublic) e [páginas de documentos](https://developer.clickup.com/reference/getdocpagespublic).
- [Limitações da exportação Docs](https://developer.clickup.com/docs/docsimportexportlimitations).
- [Anexos paginados](https://developer.clickup.com/reference/getparententityattachments).
- [Esquemas oficiais OpenAPI](https://developer.clickup.com/docs/open-api-spec).
