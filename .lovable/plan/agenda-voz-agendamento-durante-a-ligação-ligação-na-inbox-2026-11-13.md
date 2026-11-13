# AGENDA-VOZ — Agendamento durante a ligação + ligação na Inbox

Porte: G. Estimativa: 9 a 12 horas, entregue em 3 fases (cada fase testada antes da próxima).

## Objetivo
A assistente de voz consulta a agenda real de quem vai receber a reunião, oferece horários na ligação, marca e manda o link pelo WhatsApp. Toda ligação aparece na Inbox como conversa, com resumo e áudio. Telas o mais parecidas possível com a campanha de WhatsApp.

## Fase 1 — Quem recebe a agenda (igual à campanha de WhatsApp)
- Na ficha da campanha de ligação, nova seção "Distribuição das reuniões", com as mesmas opções e textos do WhatsApp:
  - Automático (responsável do Lead/Contato; se não tiver agenda conectada, fica sem agendamento e cai no WhatsApp)
  - Membro específico
  - Rodízio entre membros selecionados
  - Sem responsável (não agenda; só envia horários pelo WhatsApp, como hoje)
- Só aparecem para escolha membros ativos com agenda Google conectada (hoje: Priscila, Guilherme, Eduarda). Quem não tem agenda aparece desabilitado com aviso "Conecte a agenda".
- Configurações de reunião na mesma seção: duração (padrão 30 min), dias à frente (padrão 7), modelo de WhatsApp com o link (lista dos aprovados do remetente, igual ao Pós-ligação).
- Checklist do "Iniciar" ganha: "Quem recebe as reuniões tem agenda conectada".

## Fase 2 — Agendamento na ligação
- A Bruna recebe duas funções: "consultar horários" e "marcar reunião".
- Consulta usa o mesmo cálculo de horários da Lia (3 opções, dias e turnos variados, sem repetir recusados, nunca inventa).
- Marca uma única vez por ligação, reconferindo a agenda antes; anfitrião definido pela distribuição (rodízio sem repetir quando várias ligações caem juntas).
- Depois de marcar: evento no Google com link de vídeo, reunião registrada na ficha do Lead/Contato e WhatsApp com o link no número do cliente (modelo aprovado, fora da janela de 24 h).
- Roteiro: opção "Agendar durante a ligação" (desligada por padrão); quando ligada, o passo 4 do roteiro passa a usar as funções.
- Se a agenda falhar: a Bruna volta à frase atual ("vou te mandar os horários no seu WhatsApp").

## Fase 3 — Ligação na Inbox
- Cada ligação vira um item na conversa do Lead/Contato na Inbox (mesma conversa do WhatsApp quando o número for o mesmo), com:
  - Cartão "Ligação" com situação, duração, roteiro e horário
  - Resumo da conversa
  - Player do áudio da gravação
  - Transcrição completa expansível
  - Reunião marcada (se houve)
- A conversa segue as regras atuais da Inbox: responsável, notificação só ao responsável, visibilidade por permissão.
- Corrige também o registro na timeline da ficha (resumo hoje não aparece).

## Permissões
- Sem chave nova: campanha usa techsales.marketing.campaigns; ligação na Inbox usa as permissões atuais de leitura da Inbox; reunião usa as regras atuais de agenda.
- Chamadas da assistente de voz só aceitas com o segredo do Agente de voz e só para ligações em andamento do próprio workspace.
- Testes: permitido, sem chave, negado, outro workspace e membro inativo.

## Ajuda
- Artigo de campanhas de ligação atualizado (Distribuição, Agendamento, Inbox) e artigo da Inbox com o novo cartão de ligação.

## Testes
- Testes automáticos para escolha de anfitrião, horários, marcação única e cartão na Inbox.
- Tela conferida no navegador com sua conta.
- Uma ligação real para +5548991104003 somente com sua autorização no fim da Fase 2.
- Nada publicado sem pedido.

## Detalhes técnicos
- Migração aditiva em prospecting_campaigns: meeting_assignment_mode, meeting_member_ids, meeting_duration_minutes, meeting_horizon_days, meeting_template_name/language; prospecting_call_attempts ganha meeting_id e host_user_id; roteiro ganha allow_booking.
- Webhook /api/public/hooks/vapi passa a responder "tool-calls" (validado pelo VAPI_WEBHOOK_SECRET, call id ligado à tentativa ativa) reaproveitando scheduling.ts e o provedor Google de store.server.ts.
- Anfitrião por wa_campaign_next_assignee-like (lock na campanha) reutilizando campaign-assignment.ts.
- Inbox: mensagem tipo "call" na conversa via serviço único de identidade; áudio por link do provedor, sem arquivo público.
