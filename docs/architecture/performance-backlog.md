# Backlog de performance — próximo ciclo

Cada item precisa de um endpoint com cursor e ordenação estável, além de testes próprios. Não
pode cortar histórico nem contagens.

1. `activity-fetch.ts`: `activities select *` sem paginação. Os e-mails são enriquecidos antes do
   filtro de data. Ordem proposta: filtrar, depois paginar por (occurred_at, id), depois enriquecer.
2. A timeline renderiza `entries.map` com tudo de uma vez. Avaliar virtualização sem quebrar
   âncoras e rascunhos.
3. O dashboard baixa milhares de linhas e agrega em JS. Mover a agregação para uma função SQL com
   RLS, mantendo as contagens exatas onde a exatidão comercial importa.
4. A Inbox carrega mensagens de 150 conversas só para descobrir o último remetente. Guardar o
   último remetente na conversa ou usar uma consulta `DISTINCT ON`.
5. A fase nitro do build repete a transformação de cerca de 5.700 módulos. Investigar a
   configuração do plugin Cloudflare/nitro antes de mexer, com medição.
6. Mais de 500 erros de prettier e o teste `hardcode-guard` já falhavam antes deste ciclo.
   Corrigir em uma tarefa separada.
7. Assinaturas de `deal_line_items` e `meetings` estão fora da publicação de tempo real. Decidir
   entre incluí-las na publicação (exige migração) ou remover a assinatura.
8. Índices: criar só a partir de um EXPLAIN de consultas interativas reais. Nada de índices
   genéricos.

## Ciclo 3
- Feito: 0087 (total, sem responsável, UUID). Pendente: feed unificado, dashboard caps, Inbox — ver performance-cycle-3.md.
