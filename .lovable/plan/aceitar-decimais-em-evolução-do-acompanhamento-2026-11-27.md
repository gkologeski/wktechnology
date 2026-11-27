# Aceitar decimais em "Evolução (%)" do acompanhamento

Porte P, estimativa 30–40 min. Sem publicar automaticamente.

## Causa
O campo de evolução dos acompanhamentos guarda apenas números inteiros (0 a 100). A tela envia 34,3, o servidor recusa e mostra o aviso técnico em inglês.

## O que muda para o usuário
- "Evolução (%)" aceita até 2 casas decimais (ex.: 34,3 ou 34,25), entre 0 e 100.
- O valor aparece com vírgula na linha do tempo do projeto, no painel de entrega do negócio e na edição.
- Erros de validação aparecem em português ("Informe a evolução entre 0 e 100, com até 2 casas decimais").
- Acompanhamentos antigos continuam com o mesmo valor.

## Detalhes técnicos
- Migration aditiva (mudança de tipo é bloqueada): nova coluna `project_updates.progress_value numeric(5,2)` com CHECK 0–100, backfill a partir de `progress_pct`, GRANT de colunas igual ao da coluna antiga, `COMMENT ... DEPRECATED` em `progress_pct`. RLS e políticas inalteradas. Conferir funções SQL que inserem em `project_updates` (migration 20260801160516) e incluir `progress_value` nelas.
- `src/lib/projects/delivery.functions.ts`: schema Zod `z.number().min(0).max(100).multipleOf(0.01)` com mensagem PT-BR; gravar/ler `progress_value`.
- `project-update-dialog.tsx`: aceitar vírgula (converter para ponto), `step="0.01"`, validação local.
- Leitores: `delivery-timeline.tsx`, `deal-delivery-panel.tsx`, `projects_.$id.entrega.tsx` usam `progress_value` formatado em pt-BR.
- Fora do escopo: metas de TechPeople (`goals-panel`, `performance.functions`) usam outra tabela.
- Validação: teste unitário do schema (34,3 aceito; 100,01 e -1 recusados), permissions:check, Ajuda do acompanhamento com bump de versão, Playwright publicando 34,3 no preview.
