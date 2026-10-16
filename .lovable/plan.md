# Nome do cliente no painel direito da Inbox WhatsApp vira link

## O que muda
- No painel direito de `/inbox/whatsapp`, o nome em destaque (ex.: "Paulo Fontes") passa a ser um link.
- Conversa associada a Contato: abre a ficha do contato. Associada a Lead: abre a ficha do lead.
- Sem associação: o nome continua sendo só texto (telefone), sem link.
- O link tem sublinhado ao passar o mouse, foco visível e uma descrição para leitores de tela ("Abrir contato Paulo Fontes").
- O link abre na mesma aba. Se você preferir que abra em nova aba, me diga.

## Fora do escopo
- Lista de conversas e cabeçalho da conversa continuam como estão.
- E-mail e Chat ao vivo não mudam.

## Detalhes técnicos
- Arquivo: `src/routes/_authenticated/inbox.whatsapp.tsx`, onde o título do painel lateral é renderizado.
- Usar `Link` do TanStack com `to="/contacts/$id"` quando houver `contact_id` (prioridade, igual à regra de identidade) ou `to="/leads/$id"` quando houver só `lead_id`. Antes, confirmar que a rota de lead existe.
- Usar só tokens semânticos (`hover:underline`, `focus-visible:ring`). Sem mudanças em backend ou banco.

## Validação
- Typecheck e lint.
- Playwright com sessão real: clicar no nome de uma conversa associada abre a ficha certa.
