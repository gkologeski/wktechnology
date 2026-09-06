# Quebrar o motor de workflows em partes menores

O arquivo que executa as ações dos fluxos automáticos tem 1.239 linhas: um único
bloco decide, um a um, o que fazer para 33 tipos de passo diferentes. A meta é
dividir por assunto até nenhum arquivo passar de 350 linhas, **sem mudar nada do
que o sistema faz**.

## Como fica a divisão

Cada grupo de passos ganha seu próprio módulo:

- **Campos**: definir campo, sub-status, limpar, incrementar, copiar de
  associação e formatar dados.
- **Responsável**: atribuir, rodízio de atribuição e atribuir recrutador.
- **Mensagens e integrações**: notificação, e-mail, WhatsApp, Slack, Teams,
  webhook e inclusão em cadência.
- **Criação de registros do CRM**: lead, contato, empresa, negócio, chamado,
  tarefa, atividade, pesquisa e abertura de negócio.
- **Recrutamento**: criar vaga, criar candidato e avançar etapa da candidatura.
- **Registros genéricos e associações**: associar, desassociar, criar, atualizar
  e excluir registro.
- **Controle de fluxo**: espera, ramificação, escolha por valor, espera até data
  e aprovação (hoje dentro da função que percorre a lista de passos).

O arquivo atual continua sendo o ponto de entrada e passa a apenas encaminhar
cada passo para o módulo do seu grupo.

## Regras de segurança

- Nenhuma mudança de comportamento, de banco, de permissão ou de RLS.
- As quatro funções públicas continuam iguais: `runActions`, `processEvent`,
  `tickWorkflows`, `tickTimeTriggers`.
- Mesmos registros de log por passo (`action`, `action_label`, `step_path`,
  `detail`, `error`) — os testes existentes verificam exatamente isso.
- Nada de renomear tipos de passo nem alterar o formato salvo dos fluxos.

## Validação

Após cada grupo extraído: `bun run typecheck:inc` e lint no arquivo alterado.
No fim: `bun run typecheck`, `bun run lint` e `bun run test` (298 testes,
incluindo os do motor de workflows). Verificação manual sugerida: abrir um fluxo
existente, executá-lo em um registro de teste e conferir o histórico de execução
passo a passo.

## Detalhes técnicos

- Novos módulos em `src/lib/workflows/engine/`, todos `*.server.ts`.
- Cada módulo exporta um handler que recebe `(supabase, action, ctx)` e devolve
  o `LogStep`; o despachante em `engine-actions.server.ts` seleciona o módulo
  pelo `action.type`, preservando a ordem e o tratamento de erro atuais.
- Helpers compartilhados continuam em `engine-shared.server.ts`; nada de
  duplicar `renderTokens`, `resolveExtraFields` ou `mergeExtra`.
- `engine-runtime.server.ts` (376 linhas) sai do teto com a extração de
  `finishRun` e da inscrição/deduplicação para um módulo de ciclo de execução.
