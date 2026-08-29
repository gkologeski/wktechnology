# Corrigir "Iniciar fila" com 5.000 leads no Quadro

## Diagnóstico (verificado no código)

- O botão "Iniciar fila" do topo (`LeadsTopBar`, usado em `src/routes/_authenticated/leads.tsx:636`) chama `fetchFilteredLeadIds(5000)` e **ignora qualquer seleção**. Como a busca agora pagina em blocos de 1.000 até o limite, ela retorna o teto de 5.000 — exatamente o número visto.
- A seleção do Quadro vive dentro de `LeadsBoard` e não é conhecida pela página: `selectedIds` (linha 127) só é alimentado pela tabela. Portanto, ao selecionar a coluna "Em Contato" e clicar no botão do topo, a seleção não é considerada.
- A ação correta já existe, mas está apenas na barra inferior de ações em massa do Quadro (`onStartQueue(selection.ids)`, `leads-board.tsx:312`), que é onde a contagem de 36 seria respeitada.

## O que será feito

1. **O botão "Iniciar fila" do topo passa a respeitar a seleção ativa** (tabela ou quadro): se houver leads selecionados, a fila usa exatamente esses IDs; sem seleção, continua percorrendo todo o filtro atual.
2. **A seleção do Quadro é comunicada à página** por callback, para que topo, contadores e toasts usem os mesmos IDs.
3. **O rótulo do botão reflete o estado**: "Iniciar fila (36)" quando há seleção, "Iniciar fila" quando não há — evitando a ambiguidade que gerou o problema.
4. **Fim do teto silencioso**: quando a fila do filtro completo atingir o limite de segurança, o toast informa que a fila foi limitada, em vez de simplesmente mostrar 5.000.
5. Mesmo tratamento para "Modo Prospecção" do topo (respeitar seleção, com o limite próprio já existente).
6. Sem alterações de schema, RLS, permissões ou regras de negócio.

## Detalhes técnicos

- `src/components/leads/leads-board.tsx`: nova prop opcional `onSelectionChange?: (ids: string[]) => void`, disparada em `useEffect` sobre `selection.ids`.
- `src/routes/_authenticated/leads.tsx`: novo estado `boardSelectedIds`; `effectiveSelectedIds` = seleção do quadro no modo Quadro, `selectedIds` no modo Tabela; `onStartQueue`/`onStartProspectingMode` do topo usam `effectiveSelectedIds` quando não vazio; toast informa truncamento quando `ids.length === limite`.
- `src/components/leads/leads-top-bar.tsx`: nova prop `selectedCount?: number` para compor o rótulo e o `aria-label` (PT-BR), sem alterar o layout.

## Como validar

1. `/leads` em Quadro → marcar a coluna "Em Contato" (36) → "Iniciar fila" (topo ou barra inferior): toast e barra de fila devem mostrar 36.
2. Sem seleção, "Iniciar fila" percorre o filtro inteiro e avisa se atingir o teto.
3. Modo Tabela permanece com o comportamento atual.

## Respondendo à segunda pergunta (gatilhos de workflow)

Hoje existem apenas `created`, `updated`, `stage_changed` (21 tabelas com trigger) e os temporais `time_since_field`, `no_activity_for`, `stuck_in_stage_for`, `field_unchanged_for`. Faltam: `deleted`; atividades/tarefas; e-mail (aberto, clicado, respondido, bounce); WhatsApp/chat; formulário enviado; agendamento/reunião; assinatura eletrônica concluída; financeiro (pagamento, conciliação, NFS-e); TechPeople; TechHire (oferta, scorecard); TechService (SLA, satisfação); e gatilhos externos (webhook, execução manual, agenda recorrente, entrada/saída de lista, limiar de score). Isso fica fora deste plano — posso planejar em seguida, começando por `deleted`, atividades/tarefas e formulário enviado.
