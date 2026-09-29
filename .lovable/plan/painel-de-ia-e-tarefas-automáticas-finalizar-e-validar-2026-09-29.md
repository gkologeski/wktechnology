# Painel de IA e tarefas automáticas — finalizar e validar

As duas coisas deste pedido já estão implementadas:
- **Painel de IA**: fica em Configurações › Integrações › Painel de IA. Mostra o modelo em uso, o custo estimado por chamada, os indicadores do período e o histórico de gatilhos, com filtros e exportação.
- **Tarefas automáticas com a IA escolhida**: os resumos automáticos, a análise de sentimento, a análise de chamados e a transcrição de ligações usam a IA do workspace de cada registro.

## O que falta
1. **Confirmar a checagem de código**: corrigi a cor do indicador "Taxa de erro", que tinha um valor inválido. Falta rodar a checagem de novo para confirmar que não sobrou erro.
2. **Fazer uma chamada real de IA**, por exemplo pelo Copiloto, e ver se ela aparece no histórico com provedor, modelo, tokens, duração e resultado.
3. **Rodar uma tarefa automática uma vez**, por exemplo a análise de sentimento, e ver se ela entra no histórico como "Automático", usando o provedor do workspace (hoje OpenRouter).
4. **Registrar o "Testar conexão" no histórico**, com o recurso "Teste de conexão", para essas chamadas também aparecerem.

## Detalhes técnicos
- `bun run typecheck` e depois o log de build em `/tmp/observability/build-errors.log`.
- Chamada real pelo navegador (Playwright com a sessão injetada) e depois uma leitura em `ai_call_logs`.
- Uma chamada ao tick de sentimento pela rota de cron, com o `CRON_SECRET`, se houver mensagem pendente.
- `testProvider` em `ai-settings.server.ts` passa a gravar o log por um helper compartilhado, reaproveitando o `writeLog`, que será exportado do resolvedor.
