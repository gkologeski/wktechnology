# Lia: novos casos de 19/10 e filtro Abertas/Fechadas na Inbox WhatsApp

## Etapa 0: diagnóstico (só leitura, antes de mudar código)
Vou ler o histórico real e os turnos da Lia de cada conversa. No relatório, cada caso separa o que foi confirmado do que não foi possível confirmar:
- **Thiago Debs:** por que, depois de receber o contato do responsável, a Lia ainda fez pergunta de qualificação (regra de terceiros sem cobertura para esse texto, ou versão publicada antiga).
- **Otávio Chaves:** o que ele escreveu e por que a Lia respondeu.
- **Luiz Cezar:** situação atual (retomadas agendadas, encerrada ou com humano) e se a Lia vai voltar a chamá-lo.
- **Demetrio Araujo:** se existe retomada agendada depois da mensagem das 13:21, para quando, e quantas ainda podem sair.
- **Pedro Lanna:** o que ficou resolvido (nome corrigido, reunião, passagem para humano) e o que está pendente.

## Etapa 1: regras da Lia (no texto de instruções e com garantia no servidor)
1. **Responsável indicado por terceiro:** depois que quem atendeu passa o contato do responsável, a Lia agradece, guarda o contato no CRM (como já faz) e encerra. Nenhuma pergunta de qualificação nem de desafio a quem não é o responsável. O servidor bloqueia qualquer pergunta depois dessa marcação.
2. **Mensagem fora de contexto:** quando o cliente escreve algo sem relação com a conversa (engano, corrente, piada, mensagem para outra pessoa), a Lia não responde. A conversa fica registrada e sem retomadas automáticas desse turno. Uma mensagem ambígua continua sendo respondida normalmente, para não silenciar clientes de verdade.
3. **Fora do perfil (ex.: desenvolvedor, não decisor):** quando o cliente diz que é desenvolvedor ou outra função fora do público da prospecção, a Lia só pede desculpas pelo contato e se despede, sem explicar o motivo. A conversa é encerrada e as retomadas são canceladas. Caso Jhoni Conzatti.
4. **"Quem me indicou?":** a resposta depende do diagnóstico do Luiz Cezar. Proposta: a Lia responde com transparência (contato encontrado em base comercial/pesquisa), sem insistir; se o cliente não responder, no máximo uma retomada.
5. **Retomadas sem resposta:** confirmar e deixar visível na Inbox o limite de retomadas por conversa e quando a próxima vai sair. Caso Demetrio.

## Etapa 2: barra Abertas / Fechadas / Todas na Inbox WhatsApp
- Nova barra acima de "Minhas / Sem dono / Interagiu / Todas", com o mesmo tamanho e estilo, e contadores.
- **Abertas:** conversas em andamento. **Fechadas:** conversas encerradas. **Todas:** sem filtro.
- Os dois filtros se combinam (ex.: Abertas + Minhas). A busca, a rolagem e o tempo real continuam como hoje. O que cada pessoa pode ver não muda.
- O filtro escolhido fica no endereço da página.

## O que não muda
Nenhuma mensagem é enviada, nenhuma conversa é reaberta e nada é publicado sem o seu aceite. Nenhum dado de cliente é alterado na Etapa 0.

## Validação
- Testes automáticos com as mensagens exatas de Thiago, Otávio e Jhoni, mais casos de controle que não podem disparar as regras.
- Testes do filtro novo e contagem conferida direto no banco.
- Playwright na barra nova. Checagem de tipos, lint, testes e build, com os resultados reais.

## Detalhes técnicos
- `whatsapp_conversations.status` já existe. Antes de mudar, confirmo os valores usados hoje (`open`/`closed` ou outros) e quem os grava (encerramento da Lia, opt-out, botão de fechar). Se o encerramento da Lia não grava `status`, ele passa a gravar.
- `src/lib/inbox/channel-page.ts` + `channel-page.functions.ts`: novo parâmetro `state: open|closed|all` e contadores `open`/`closed` em `ChannelCounts`.
- Migration aditiva atualizando `get_inbox_channel_page` (mesma assinatura com novo parâmetro opcional, SECURITY INVOKER, RLS preservada); índice em `(workspace_id, status, last_message_at)` se faltar.
- `inbox.whatsapp.tsx`: segunda `TabsList` acima da atual, mesmo estilo compacto.
- Regras da Lia: `conversation-guards.ts`, `policy.ts` e `worker.server.ts`, com novos marcadores no enrollment (`referral_received`, `off_topic`, `out_of_icp`); prompt em `agent.server.ts`.
