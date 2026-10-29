# Importação ClickUp → TechProjects (com suas decisões)

Porte: G. Estimativa: 2 a 3 dias de trabalho, entregue em 4 pacotes revisáveis.

## Decisões aplicadas
1. As 6.256 "Dailys" do Outsourcing entram como tarefas.
2. Byteway (Consultoria) vira um projeto novo de Consultoria, com a mesma estrutura do ClickUp.
3. Projetos repetidos (OS-Citel / OS - Citel, OS-IXC / OS - IXC, OS-INFORMA / OS - In Forma, OS-Quantity / OS - Quantity) são unificados: antes de juntar, confiro cada par (cliente, apontamentos, tarefas). Só junto o que não gera conflito; o restante vai para revisão manual. Nada é apagado: o projeto absorvido fica arquivado e com vínculo ao principal, e a junção pode ser desfeita.
4. Workspaces de teste (Cliente Exemplo, CS, Logbit) ficam de fora.
5. A chave pessoal do ClickUp é removida do campo "lista padrão" das configurações da integração. A chave segura do servidor continua sendo a única usada.

## Pacotes
**P1 — Limpeza e unificação (meio dia)**
- Limpar a chave do campo da lista padrão.
- Comparar os 4 pares de projetos, mostrar o resultado e juntar os seguros (tarefas e horas passam para o principal).

**P2 — Importação revisável (1 dia)**
- Gravar a estrutura proposta: Diretoria, Gestão, Fábrica de Software, Consultoria, Outsourcing e um espaço por cliente de Outsourcing.
- Importar tarefas, subtarefas, status, datas, responsáveis, tags e comentários.
- 3.610 tarefas que já aparecem nos apontamentos do Clockify (códigos "#86…") são ligadas ao projeto existente, sem duplicar e sem mexer nas horas.
- Horas do ClickUp não entram (o Clockify continua sendo a fonte).
- Cada item importado guarda o identificador do ClickUp e o lote de importação, permitindo desfazer o lote inteiro.

**P3 — Tela de revisão e responsáveis (meio dia)**
- Tela em TechProjects › Configurações › ClickUp: resumo do lote, itens sugeridos, conflitos, pessoas a vincular (62 de 63 responsáveis precisam de vínculo manual por causa do e-mail @mail.wktechnology.com.br) e botão "Desfazer importação" com confirmação.

**P4 — Permissões e validação (meio dia)**
- Novas permissões: ver importação, executar importação, desfazer importação e unificar projetos, cadastradas em Configurações › Permissões, sem concessão automática a nenhum cargo.
- Testes: permitido, sem permissão, negado, outro workspace e membro inativo.
- Verificação final: testes, tipos, lint, build e teste da tela no navegador.

## Fora do escopo
- Sincronização contínua ClickUp ↔ TechProjects (este trabalho é uma carga única revisável).
- Publicação: só com seu aceite.

## Detalhes técnicos
- Migration aditiva: colunas `clickup_id`, `import_run_id` nas tabelas de espaços/pastas/listas/tarefas do TechProjects (ou tabela de vínculos `clickup_record_links`), tabela `clickup_import_runs`, e `merged_into_project_id` em projetos; GRANT + RLS por workspace + permissões novas no catálogo.
- Planejamento puro (sem gravação) testável, separado do executor no servidor; leitura do ClickUp pela chave do servidor.
- Deduplicação: código `#86…` dos apontamentos Clockify → tarefa existente; `clickup_id` impede reimportar.
- Unificação: mover tarefas/apontamentos/membros para o principal, arquivar o absorvido, registrar mapeamento para desfazer.
