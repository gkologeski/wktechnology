# Fechar janelas de atividade sem aviso, com rascunho automático

## Comportamento
- Botão Fechar (X) fecha a janela imediatamente, sem aviso.
- Exceção mantida: ligação em andamento continua impedindo o fechamento (evita derrubar a chamada).
- Todo conteúdo digitado em qualquer janela de atividade (nota, tarefa, ligação registrada, reunião, WhatsApp, e-mail, LinkedIn, edição de atividade, ações em massa) é salvo como rascunho automaticamente.
- Ao reabrir a mesma ação no mesmo registro, o rascunho volta como estava, com o indicador "Rascunho salvo às HH:MM".
- Botão "Descartar rascunho" (com confirmação) no rodapé de cada janela limpa o conteúdo.
- Ao salvar/enviar com sucesso, o rascunho é apagado.

## Detalhes técnicos
- `activity-windows.tsx`: remover o `window.confirm` do `onClose`; manter o bloqueio `closeBlocked` da ligação.
- E-mail e WhatsApp: continuam usando o rascunho no servidor já existente (`useMessageDraft`), que já grava ao fechar.
- Demais formulários: novo hook `use-activity-draft.ts` com persistência local (localStorage), chave `activity-draft:<userId>:<workspaceId>:<ação>:<relatedKey>:<relatedId|activityId|bulk>`, debounce de ~500 ms, gravação imediata ao desmontar, restauração ao abrir, `discard()` e `clearAfterSave()`. Sem mudança de banco ou permissões. Anexos novos (arquivos ainda não enviados) não são mantidos no rascunho local; anexos já existentes sim.
- Aplicar em `TimelineComposer`/`ActivityLogWindow`, `QuickCreateTaskDialog`, `MeetingDialog`, `ActivityEditWindow` e `BulkCreateActivityDialog`, reaproveitando o indicador `message-draft-status`.
- Rascunhos locais de outro usuário/workspace nunca são lidos (chave inclui ambos); limpeza ao sair da conta.

## Validação
- Typecheck, lint, testes unitários do hook.
- Playwright: digitar em nota e tarefa, fechar sem aviso, reabrir e ver conteúdo; descartar; salvar e confirmar que o rascunho some; ligação em andamento continua sem fechar.
