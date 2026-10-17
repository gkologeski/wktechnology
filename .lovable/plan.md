# Barra "Inbox WhatsApp" com metade da altura

A faixa do topo da Inbox (título, abas Unificada/Email/WhatsApp/Chat ao vivo e botões à direita) cai de cerca de 50 px para cerca de 25 px. Nada é removido: abas, ícones, botão Configurar e demais ações continuam iguais e clicáveis. Vale para as quatro telas da Inbox, que usam a mesma faixa.

## Detalhes técnicos
- Arquivo: `src/components/inbox/inbox-workspace.tsx`.
- Header: `py-1.5` → `py-0.5`; `mb-2` → `mb-1.5`.
- Abas (`InboxChannelTabs`): `min-h-9 py-2` → `h-6 py-0`, ícone `h-3.5 w-3.5`, texto `text-xs`; nav sem `pb-0.5`.
- Ações: `[&_[data-slot=button]]:h-8` → `h-6` com `text-xs`.
- Conferir com Playwright em 1183x653 medindo a altura do header (meta ≤ 28 px).
