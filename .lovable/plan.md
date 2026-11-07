# Erro "canceling statement due to statement timeout" ao mover lead para Reunião Comercial

Porte P. Estimativa de 45 min a 1 h, sem dependências externas.

## O que acontece (confirmado)
- A mudança de etapa **foi salva**: o Alan Fuentes está em "Reunião Comercial", com o substatus "Aguardando agendamento".
- Depois de salvar, a ficha pede ao sistema que rode na hora as automações pendentes. Essa busca procura eventos pendentes na fila de automações do workspace, que tem cerca de 530 mil eventos. Ela checa a permissão evento a evento e passa do tempo limite. O registro do banco mostra essa mesma consulta estourando às 11:12, 11:17 e em outros momentos.
- O aviso vermelho vem dessa busca, não da mudança de etapa. As automações continuam rodando depois, pela rotina automática a cada 2 minutos.

## O que será feito
1. **Busca rápida e com a mesma regra de acesso:** primeiro o sistema separa só os poucos eventos pendentes, usando o índice que já existe. Depois confere a permissão do usuário somente nesses eventos. A regra de quem pode processar o quê não muda.
2. **Aviso amigável:** se a execução imediata falhar, a ficha não mostra mais o erro técnico, porque a etapa já foi salva. Aparece uma mensagem curta: "Etapa salva. As automações serão executadas em instantes."
3. **Teste:** um teste automático cobre a regra "a busca imediata só processa eventos pendentes que o usuário pode ver". Depois, no navegador, mudo a etapa de um lead de teste, confiro que não aparece erro e devolvo o lead à etapa original.
4. **Item relacionado:** no mesmo período, o registro do banco mostra outra consulta lenta: a busca das reuniões do usuário. Vou medir essa busca e, se ela for a causa de avisos nessa tela, corrijo no mesmo pacote. Se não for, deixo registrada como pendência.

## Detalhes técnicos
- Em `src/lib/workflows/caller-tick.server.ts`, depois dos controles de workspace e de `can_manage` que já existem, ler os ids pendentes com `supabaseAdmin`: workspace, `processed_at is null`, `run_at <= now`, ordenado por `created_at`, com limite e, quando houver, filtrado por `eventIds`. Em seguida, reler esses ids com o cliente do usuário (`.in("id", ids)`), para que a RLS `sales_view` decida só sobre essas linhas, buscadas pela chave primária.
- Causa: `sales_context_access` e `sales_event_reference_access` não são leakproof, então a RLS avaliava as linhas do workspace antes do filtro de pendentes.
- Em `leads.$id.tsx` (cerca da linha 280), trocar `toast.error(error.message)` pela mensagem amigável e manter o log.
- Atualizar o hash no contrato de permissões dos arquivos alterados e rodar `permissions:check`.
