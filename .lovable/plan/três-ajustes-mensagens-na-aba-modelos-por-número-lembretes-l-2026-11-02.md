# Três ajustes: Mensagens na aba, modelos por número, lembretes livres

Porte: M · Estimativa: ~1h30.

## 1. "Mensagens" não aparece na aba azul
- Sua conta tem a permissão do mensageiro, e no meu teste a opção apareceu. A suspeita é que a aba depende de um "aviso" que o mensageiro manda uma única vez; se esse aviso se perde (por exemplo, após atualização da prévia), a opção some.
- Correção: a própria aba passa a conferir a permissão e o contador de não lidas diretamente, sem depender desse aviso. Antes, vou reproduzir com a sua conta na tela Módulos para confirmar a causa.

## 2. Modelos iguais para qualquer número (Lembretes de reunião)
- Causa: a lista de modelos é carregada só para o número já salvo. Ao trocar o número na tela, a lista não é recarregada.
- Correção: ao escolher outro número, a tela busca os modelos aprovados daquele número na hora, limpa modelos que não existem nele e mostra um carregando enquanto busca. O servidor continua conferindo no salvar.

## 3. Lembretes definidos pelo usuário
- Em vez das 4 opções fixas, uma lista estilo "itens de pedido":
  - linha = [número] + [minutos | horas | dias] + "antes" + modelo + espaços do modelo + prévia;
  - botão "Adicionar lembrete" e lixeira em cada linha (com confirmação);
  - limites: de 1 minuto a 30 dias antes; até 10 lembretes; não pode repetir o mesmo tempo.
- Lembretes atuais (24h, 3h, 1h, 5min já salvos) continuam valendo e aparecem como linhas.
- O envio, a regra de "no máximo uma vez por reunião" e a tolerância de atraso seguem iguais; o agendador já trabalha com qualquer tempo.

## Detalhes técnicos
- Migração: remover o CHECK fixo de `meeting_reminder_rules.offset_minutes` e trocar por CHECK 1..43200; adicionar `offset_unit text default 'minutes'` (minutes/hours/days) só para reexibir a unidade escolhida.
- `meeting-reminders.ts`: helpers `toMinutes(amount, unit)` / `fromMinutes`, rótulo dinâmico; remover uso de `REMINDER_OFFSETS` na tela; testes novos para conversão, limites e duplicidade.
- `meeting-reminders.functions.ts`: nova `listMeetingReminderTemplates({ sender })` (mesma permissão view); `save` aceita lista variável (≤10, únicos, 1..43200), apaga regras removidas e grava as novas.
- `side-dock.tsx`: usar `usePermissions` + `messengerAllowed` e ler o contador do cache `["chat","conversations"]`; o store fica só para abrir as janelas.
- Atualizar contratos de permissão, `permissions:check`, testes e conferência no navegador com sua conta.
