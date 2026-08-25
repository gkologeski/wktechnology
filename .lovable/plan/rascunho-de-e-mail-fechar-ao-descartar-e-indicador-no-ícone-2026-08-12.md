# Rascunho de e-mail: fechar ao descartar e indicador no ícone

## Comportamento

1. Descartar rascunho fecha o modal
   - No modal "Novo email", ao confirmar "Descartar rascunho": remove o rascunho e os anexos, limpa os campos, mostra o toast "Rascunho descartado" e fecha o modal automaticamente.

2. Pin de rascunho no ícone de e-mail
   - Quando existir rascunho salvo para aquele contexto (lead, contato, empresa, negócio ou thread), o botão/ícone de e-mail que abre o composer exibe um marcador discreto (ponto/pin no canto superior direito do ícone), com título acessível "Rascunho salvo".
   - O marcador desaparece assim que o rascunho é descartado ou o e-mail é enviado.
   - Aplicado aos gatilhos de e-mail do sistema: barra de ações da timeline (lead, contato, empresa, negócio), player de filas de tarefas e botão de responder da Caixa de entrada.

## Detalhes técnicos

Servidor (`src/lib/message-drafts.functions.ts`)

- Nova server function `hasMessageDrafts({ channel, scope_keys[] })` com `requireSupabaseAuth`: retorna as chaves que possuem rascunho do usuário atual (`owner_id = auth.uid()`), sem devolver conteúdo. Sem mudança de schema, RLS ou permissões.

Cliente

- Novo hook `src/hooks/use-has-message-draft.ts`: usa `useQuery` (queryKey `["message_draft_exists", channel, scopeKey]`) para saber se há rascunho; `scopeKey` derivada da mesma função `draftScopeKey` já existente.
- Novo componente `src/components/message-draft-pin.tsx`: wrapper presentacional que posiciona um ponto (tokens semânticos, ex.: `bg-primary`/`ring-background`) sobre o ícone, com `aria-label`/`title` "Rascunho salvo".
- `src/components/email/send-email-dialog.tsx`:
  - `AlertDialogAction` de descarte passa a chamar `setOpen(false)` depois de limpar estado.
  - Após salvar/descartar/enviar rascunho, invalida a query `message_draft_exists` da respectiva chave para o pin atualizar em tempo real.
  - Nova prop opcional `draftIndicator` (default ligado quando há `trigger`): envolve o `trigger` com o pin quando existe rascunho.
- `src/hooks/use-message-draft.ts`: expõe callbacks já existentes (`discard`, `clearAfterSend`) e passa a invalidar a query de existência do rascunho.
- Ajuste nos pontos de uso onde o gatilho é controlado externamente (timeline, player de filas, inbox) para exibir o pin no ícone de e-mail.

Fora do escopo: WhatsApp (o pedido é sobre e-mail), schema, RLS e regras de envio.

## Validações previstas

typecheck, lint, build e testes unitários existentes.
