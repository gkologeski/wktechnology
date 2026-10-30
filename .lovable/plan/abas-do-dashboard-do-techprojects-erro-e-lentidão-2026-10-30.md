# Abas do Dashboard do TechProjects: erro e lentidão

Estimativa: porte M, 1 h 30 a 2 h.

## O que medi (sua conta, outubro/2026)
| Aba | Resultado |
|---|---|
| Meu trabalho | erro em 1 s: a conta de capacidade procura o campo "criado por" nas alocações de pessoas, que não existe (só há responsável e dono) |
| Equipe e entrega | 40 s e queda da conexão |
| Comercial | 7 s e queda |
| Financeiro e gestão / Qualidade dos dados | caíram logo em seguida, ainda com a conexão abalada pela aba Equipe; medir de novo depois da correção |

Banco saudável (memória 38%, 8/90 conexões). A lentidão vem da mesma causa do resumo corrigido antes: as contas das abas conferem o acesso a cada uma das 32 mil tarefas e a cada projeto, lendo de novo todas as suas permissões por linha.

## O que vou fazer
1. **Meu trabalho:** trocar "criado por" pelo dono da alocação na conferência de acesso às alocações (mesmo critério que a tela de alocações usa). Confirmo antes no banco qual campo a regra de alocações espera.
2. **Tarefas e projetos nas abas:** usar a via rápida já criada — quem vê todo o workspace é conferido uma vez por busca; os demais seguem conferidos linha a linha, como hoje.
3. **Medir aba por aba** de novo; onde ainda passar de 2 s, analisar o plano de execução daquela conta (apontamentos, negócios, medições, previsões) e aplicar a mesma via rápida ou índice que faltar.
4. Conferir que os números de cada aba batem com a contagem direta antes de dar como resolvido.
5. Abrir as 6 abas no navegador.

## Regras mantidas
- Quem vê o quê não muda; a regra por linha continua decidindo para quem não tem acesso total.
- Mudança via migração nova + registro de permissões com os 5 testes de acesso.
- Nada publicado sem seu aceite.

## Técnico
- `project_dash_capacity_base`: `a.created_by` → `a.owner_id` em `hr_person_resource_access` (validar assinatura/semântica do parâmetro).
- `project_dash_ds_tasks` (e `ds_projects`/`capacity_base`): prefixar `t.workspace_id = (SELECT work_view_full_workspace('techprojects.tasks')) OR work_context_access(...)`; idem `work_record_context_access` para projetos.
- Depois, `EXPLAIN ANALYZE` de `ds_entries`, `ds_deals`, `ds_forecast`, `ds_measurements`, `ds_cost`, `ds_alerts` para as abas restantes.
