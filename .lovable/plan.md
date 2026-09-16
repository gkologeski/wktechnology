# Por que o contrato não foi criado

## O que aconteceu (verificado no banco)

O workflow **rodou** e terminou com sucesso às 10:11 de hoje. Ele não criou contrato porque **o negócio não tem nenhum item de linha (serviço) cadastrado**.

Sequência real:

1. O negócio "CT/Teste/Teste/Pacote de 25 horas" entrou no substatus "Contrato em elaboração" — o gatilho disparou corretamente.
2. O primeiro passo do workflow é "Ramificar por valor" pelo campo **Serviço dos itens do negócio**.
3. O negócio tem **zero itens de linha** e valor R$ 0,00, então o serviço ficou vazio.
4. A ramificação caiu no caminho **"Nenhuma das opções" (padrão)**, que está **sem nenhuma ação** configurada.
5. Resultado: execução marcada como sucesso, nenhum contrato criado.

Ou seja: não é falha do gatilho nem da ação de contrato. É falta do serviço no negócio combinada com um caminho padrão vazio, que hoje passa em silêncio.

Observação secundária encontrada: esse negócio está com **etapa "Em negociação" e substatus da etapa "Contratação"** ao mesmo tempo. Vale confirmar se a movimentação no quadro está atualizando os dois campos juntos.

## Como resolver agora (sem código)

Adicionar o serviço nos itens de linha do negócio (ex.: o pacote de 25 horas com o serviço "CT") e mover novamente para a etapa de contratação. Com o serviço preenchido, a ramificação "CT" é escolhida e o contrato é criado.

## O que eu proponho implementar

### 1. Nunca mais falhar em silêncio

- Quando uma ramificação cair no caminho padrão e esse caminho estiver vazio, registrar no log da execução um aviso legível: "nenhum item de negócio com serviço — nada foi executado".
- Marcar a execução como **"Concluído sem ação"** em vez de "Sucesso", para o usuário distinguir na lista de execuções.

### 2. Aviso no construtor de workflows

- No passo "Ramificar por valor", mostrar um alerta quando o caminho padrão estiver vazio, explicando que negócios fora das opções não farão nada.

### 3. Aviso no negócio antes de contratar

- Ao mover um negócio para a etapa/substatus de contratação sem nenhum item de linha, exibir aviso ("Este negócio não tem serviços; automações de contrato não vão rodar") com atalho para abrir os itens de linha. Sem bloquear a movimentação.

### 4. Verificar etapa x substatus

- Conferir o caminho de movimentação no quadro e no formulário: ao escolher um substatus que pertence a outra etapa, a etapa deve acompanhar. Corrigir se estiver divergindo.

## Detalhes técnicos

- Motor: `src/lib/workflows/engine/actions-control.server.ts` (ramificação `switch_by_value`) passa a anotar `matched: "default"` com `no_op: true` e mensagem em PT-BR; `src/lib/workflows/engine.server.ts` grava o status "sem ação" no run.
- Hidratação dos itens: `src/lib/workflows/line-items.server.ts` já carrega `deal_line_items`; nada muda na leitura, só no relato quando a lista vem vazia.
- Construtor: alerta em `src/components/workflows/builder/step-forms/` no formulário do switch.
- Negócio: aviso no fluxo de mudança de etapa/substatus em `src/components/deals/**`, usando componentes oficiais do design system (sem novo layout).
- Sem alteração de schema, RLS, permissões ou regras de negócio.

## Validação

- Testes unitários para o caso "switch sem correspondência e padrão vazio".
- `bun run typecheck`, `bun run lint`, `bun run test`.
- Conferência manual: adicionar item de linha com serviço CT no negócio de teste, mover para contratação e confirmar contrato criado; repetir sem itens e confirmar o aviso.

## Escopo

Diagnóstico já concluído. A implementação cobre apenas visibilidade/aviso e a checagem etapa x substatus. Não altera o workflow existente do usuário nem cria contrato retroativamente.
