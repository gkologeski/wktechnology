# Backlog de performance — próximo ciclo

Cada item precisa de um endpoint com cursor e ordenação estável, além de testes próprios. Não
pode cortar histórico nem contagens.

1. [Feito no ciclo 3 A] Timeline paginada no servidor (0087–0089, 0094) em atividades, histórico e calendário.
2. A timeline renderiza `entries.map` com tudo de uma vez. Avaliar virtualização sem quebrar
   âncoras e rascunhos.
3. [Feito no ciclo 3 B] O dashboard baixava milhares de linhas e agregava em JS. Mover a agregação para uma função SQL com
   RLS, mantendo as contagens exatas onde a exatidão comercial importa.
4. [Feito nos ciclos 4 e 5] Inbox unificada (0095/0096) e telas por canal (0097) paginadas no servidor;
   último remetente por `LIMIT 1` só nas linhas da página.
5. A fase nitro do build repete a transformação de cerca de 5.700 módulos. Investigar a
   configuração do plugin Cloudflare/nitro antes de mexer, com medição.
6. Mais de 500 erros de prettier preexistentes (pendente). `hardcode-guard` corrigido no ciclo 3.
7. Assinaturas de `deal_line_items` e `meetings` estão fora da publicação de tempo real. Decidir
   entre incluí-las na publicação (exige migração) ou remover a assinatura.
8. Índices: criar só a partir de um EXPLAIN de consultas interativas reais. Nada de índices
   genéricos.

## Ciclo 3
- Ciclo 3 A: feed paginado em 3 origens (0088), e-mail sob demanda, recarga silenciosa sem reset — ver performance-cycle-3.md.
- Ciclo 3 B: dashboard sem tetos (0090–0092). Ciclo 4 C: Inbox unificada paginada (0095/0096), validada em banco isolado; pendente RLS não-admin no banco real e telas por canal — ver performance-cycle-4-inbox.md.
- Ciclo 5: telas Email/WhatsApp/Chat paginadas (0097) e tempo real de e-mail filtrado por caixa — ver
  performance-cycle-5-channels.md. Pendente: RLS não-admin no banco real (requisito de publicação),
  paginação do histórico de mensagens dentro da conversa e entrega real do evento de e-mail.
