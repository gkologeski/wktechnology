## Objetivo

Refinar o fluxo de ações da tela de execução de fila de Prospecção (`/prospecting/queues/$queueId/play`) para alinhar com o fluxo padrão de Leads e simplificar a interface.

## Decisões confirmadas

1. **Nutrição**: manter botão como "Enviar para nutrição" (remove da fila ativa, mantém lead vivo com status `nurturing`).
2. **Escopo da fila**: filas de prospecção passam a aceitar **apenas leads**. Contatos e empresas não são elegíveis.
3. **Desqualificação**: motivo **obrigatório**.
4. **Agendado**: botão removido.

## Mudanças

### 1. Restringir filas a leads apenas
- Em `src/components/prospecting/add-to-queue-dialog.tsx` (e telas equivalentes em `/contacts` e `/companies`): remover a opção de adicionar contatos/empresas à fila de prospecção. Manter apenas em `/leads`.
- Em `src/lib/prospecting/queues.functions.ts`: validar no `addItemsToQueue` que apenas `entity_type = 'lead'` é aceito; retornar erro claro caso contrário.
- Na UI de listagem da fila (`queue-tab.tsx` e `play.tsx`): remover branches que tratam `contact`/`company`.

### 2. Botão "Qualificar" → abre CreateDealFromLeadDialog
- Em `qualification-panel.tsx`: substituir a lógica atual de qualificação pelo mesmo diálogo usado em `/leads` (`CreateDealFromLeadDialog`).
- Após criação do negócio: registrar `qualification` na prospecção (score + respostas do questionário) e marcar item da fila como `qualified`, avançando para o próximo.

### 3. Botão "Desqualificar" com motivo obrigatório
- Abrir modal com `Select` de motivos + campo texto opcional para observação.
- Validação: submit desabilitado até motivo ser escolhido.
- Ação: atualizar `leads.status = 'disqualified'`, `lost_reason`, e marcar item da fila como `disqualified`. Avançar para próximo.

### 4. Botão "Enviar para nutrição"
- Renomear botão "Nutrição" → "Enviar para nutrição".
- Ação: atualizar `leads.status = 'nurturing'` (adicionar valor ao enum se não existir), marcar item da fila como `nurturing`/removido, e avançar.

### 5. Remover botão "Agendado"
- Remover do `qualification-panel.tsx` e da tela `play.tsx`.

## Detalhes técnicos

- **Migration necessária**: adicionar `'nurturing'` ao enum `lead_status` se ainda não existir; adicionar valor `'nurturing'` aos status possíveis de item da fila.
- **Sem alteração** em RLS, autenticação ou schema além do enum.
- Reaproveitar `CreateDealFromLeadDialog` sem duplicação.
- Manter atalhos de teclado (N/S) e navegação sequencial.

## Como validar

1. Em `/leads`, adicionar leads à fila de prospecção — deve funcionar.
2. Em `/contacts` e `/companies`, a opção "Adicionar à prospecção" não deve mais aparecer.
3. Em `/prospecting/queues/:id/play`:
   - "Qualificar" abre o mesmo modal do `/leads` e cria um negócio.
   - "Desqualificar" exige motivo.
   - "Enviar para nutrição" remove da fila e muda status do lead.
   - Não há mais botão "Agendado".

## Fora de escopo

- Migração de itens já existentes na fila que sejam contact/company (será tratado à parte se necessário).
- Redesenho visual da tela `play`.
