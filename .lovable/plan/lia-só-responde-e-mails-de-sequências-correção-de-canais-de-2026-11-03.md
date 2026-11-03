# Lia só responde e-mails de sequências + correção de "Canais de Atendimento"

Estimativa total: porte P/M, cerca de 1h30 a 2h.

## 1. Lia responde apenas e-mails das sequências (P/M, ~1h–1h30)

Hoje, com a Lia ligada no seu e-mail, qualquer e-mail recebido entraria na fila dela. Depois da mudança:
- A Lia só trata um e-mail recebido quando ele é **resposta a um e-mail enviado por uma sequência ou campanha** (mesma conversa do Gmail ou cabeçalho de resposta apontando para um e-mail nosso de sequência).
- Todos os outros e-mails continuam chegando normalmente na sua caixa e na Inbox, sem a Lia responder.
- WhatsApp não muda.

Detalhes técnicos:
- Nova migration alterando a função que coloca o e-mail recebido na fila do agente: para canal e-mail, só enfileira se o `thread_id`/`in_reply_to` bater com uma mensagem de saída vinda de sequência/campanha (origem registrada no envio). Caso contrário, pula sem erro.
- Se a origem do envio não estiver gravada hoje, incluir essa marca no envio de passos de e-mail das sequências.
- Testes: resposta de sequência entra na fila; e-mail comum não entra; outro workspace não entra.
- Regra de permissões: sem nova tela/ação; registrar contrato atualizado e rodar `permissions:check`.

## 2. Configurações → Integrações → Canais de Atendimento abre vazio (P, ~20 min)

- Incluir "Canais de atendimento" no grupo Integrações da tela de Configurações.
- Quando um endereço interno (ex.: `/settings/channels`) estiver aberto, mostrar o conteúdo dele em vez da grade de opções do grupo; a grade só aparece ao clicar no nome do grupo.
- Conferir com Playwright: clicar no menu abre a tela de canais; Engajamento e Lembretes continuam funcionando.

## Depois disso (você faz pela tela)
Em Canais de atendimento: ativar o canal `guilherme@wktechnology.com.br`, escolher a Lia com "Campanhas" e "Respostas", salvar e validar de novo a sequência de teste.

## Não incluso
Esperas de 1 minuto nas sequências e publicação (só quando você pedir).
