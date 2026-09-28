# Bloquear canais não configurados na barra de atividades

## Objetivo
Nas ações de envio da timeline (lead, contato, negócio), mostrar cada canal como indisponível quando ele não estiver configurado. Ao lado do canal, exibir uma engrenagem colorida clicável que leva à tela de configuração daquele canal.

## Canais avaliados e como saber se estão prontos

| Ação de envio | Considerado pronto quando | Engrenagem leva para |
|---|---|---|
| Enviar WhatsApp | O workspace tem pelo menos um número do WhatsApp Business conectado | Configurações › WhatsApp |
| E-mail | O usuário tem uma conta de e-mail conectada com status "connected" | Configurações › E-mail |
| Ligação | As credenciais de telefonia (Twilio) estão válidas no servidor | Configurações › Agente de voz / telefonia |
| Reunião | O workspace tem uma agenda conectada (Google/Microsoft) | Configurações › Agendas |

As ações "Registrar e-mail/chamada/reunião/WhatsApp" continuam liberadas, porque só registram algo que já aconteceu fora do sistema e não enviam nada.

## Comportamento na tela
- Canal indisponível: o botão fica esmaecido e não abre a janela. A dica ao passar o mouse diz "WhatsApp não configurado — clique na engrenagem para configurar" (e o equivalente para cada canal).
- Engrenagem: pequeno ícone colorido de engrenagem sobreposto ao canto do botão, com foco pelo teclado e nome acessível ("Configurar WhatsApp"). No menu "Mais", aparece ao lado do nome da ação.
- Enquanto a verificação carrega, o botão continua funcionando normalmente, para não piscar como bloqueado. Se a verificação falhar, o canal também fica liberado, e a janela continua mostrando o aviso atual ao tentar enviar.
- Os dados de status ficam em cache por alguns minutos e são atualizados quando você volta das telas de configuração.

## Fora do escopo
- Nenhuma mudança no banco, nas permissões ou nas regras de envio.
- "Sequência" e "LinkedIn" continuam como "Em breve".

## Detalhes técnicos
- Nova server function `getChannelAvailability` (em `src/lib/channel-availability.functions.ts`, com `requireSupabaseAuth`) que retorna `{ whatsapp, email, call, meeting }` com `{ ready: boolean, reason?: string }`, reaproveitando as mesmas consultas de `listPhoneNumbers`, `listEmailAccounts` e `listCalendarAccounts`, além de uma verificação apenas da presença e do formato das variáveis Twilio (sem chamar a API externa).
- Hook `useChannelAvailability()` com `useQuery` (staleTime de cerca de 5 min) e chamada via `useServerFn`, fora de loaders.
- `BarAction` ganha o campo opcional `channel`; `timeline-action-bar.tsx` combina esse campo com o status para desabilitar a ação e renderizar `ChannelSetupGear` (ícone `Settings` do lucide com token semântico de cor, `Link` para a rota de configuração e `stopPropagation` para não disparar o arrasto e soltar).
- `activity-windows.tsx` passa a ignorar solicitações de canais indisponíveis, igual ao que já faz com `disabled`.
- Validação: typecheck (tsgo), ESLint, teste unitário do mapeamento canal → rota → status e verificação no navegador com o WhatsApp não conectado.
