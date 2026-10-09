# Performance — ciclo 3 (09/10/2026) — PARCIAL

Base: commit do ciclo 2 `5c573cea5`. Sem publicação, envios ou alteração de dados reais.

## Implementado e validado
- `0087_performance_cycle3_timeline_count_fix.sql` (aditiva, `CREATE OR REPLACE`, mesma assinatura — clientes antigos compatíveis):
  1. `total` = soma das contagens por categoria (antes contava categorias).
  2. Contrato do responsável explícito: sem IDs e sem "sem responsável" → sem filtro; só "sem responsável" → apenas
     `COALESCE(assigned_to, owner_id) IS NULL`; IDs + flag → união. Antes, só a flag liberava tudo.
  3. UUID de e-mail validado pelo formato canônico 8-4-4-4-12 dentro de `CASE` (cast nunca avaliado para texto inválido).
- Teste SQL real `tests/sql/timeline-activity-page.sql` (transação com `ROLLBACK`, fixture isolada):
  45 atividades (30 notas/15 ligações) → total 45, contagens corretas, páginas 40+5 sem sobreposição,
  filtro categoria 15, só-responsável 45, "sem responsável" 0 (todas têm `owner_id`, semântica de fallback preservada),
  busca com `external_ids` malformados não quebra (0), entidade vazia → total 0.
  Executado com papel privilegiado do sandbox: **não valida RLS**.
- `performance-cycle-2.md` corrigido (total, bundle 303→310 KB gzip é piora, build 149,3 s amostra única).

## Pendente (não iniciado neste ciclo)
- A: feed unificado (histórico indivisível + calendário com dedup antes da paginação, sem caps de 300), busca no
  histórico, e-mail sob demanda, cursor/cache vinculados ao contexto, realtime sem reset. Teste RLS com sessão real.
- B: jornada de leads, atividades 14/30 dias e listas secundárias ainda com 3.000/5.000/10.000.
- C: Inbox — não iniciado (depende de A/B).
- Medições antes/depois autenticadas, suíte completa e build deste ciclo não executadas além da migração.

## Rollback
Reaplicar a definição de 0086 via nova migração `CREATE OR REPLACE` (sem perda de dados).
