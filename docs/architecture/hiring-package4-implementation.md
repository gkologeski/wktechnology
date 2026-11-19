# Pacote 4 — Execução e Financeiro

Base publicada: pacote 3, PR #42, main 8678580ee; código dc4ea4da. Autorização: implementar, testar, aplicar migrações e publicar. Estimativa inicial 6–10 h; reavaliar após auditoria dos adaptadores.

## Escopo aprovado e fontes

O pacote 4 do protótipo aprovado em 18/11 é “Alocação ou entrega, aceite versionado, NF, parcelas sem duplicidade. Sem automatizar pagamento”. Não confundir com a antiga etapa 4 da integração ATS. Auditoria de referência: outputs/contratacoes-profissionais-fornecedores-2026-11-18/auditoria.html (artefato local). Professional e supplier partem das solicitações e do instrumento canônico do pacote 3.

Reaproveitar hiring_engagements / people_allocations, projetos e marcos, horas e períodos canônicos, hiring_monthly_provisions, financial_entries e seus controles/recorrências. Não usar a medição de venda como gerador de contas a pagar.

## Lotes de implementação

1. Início e origem profissional direta: autorização explícita do gestor atual com permissão própria, assinatura válida da versão corrente, CNPJ/vigências/escopos. Reutilizar pessoa/vínculo e alocação; nenhuma vaga ou candidatura fictícia. Cargo/modelo quando necessário participa de demanda governada, nunca escolha implícita. Acesso/convite permanece ação IAM separada. Fornecedor não cria empregados automaticamente.
2. Entregas e documentos: critérios e condições estruturados e versionados a partir do instrumento assinado, associação canônica ao projeto/marco quando houver. Conclusão não equivale a aceite técnico. Aceite humano nomeado e versionado, revogação/invalidação auditada. NF/documento comprobatório privado, metadados e integridade, conferência financeira explícita; não afirmar autenticação fiscal externa sem integração.
3. Financeiro: plano de parcelas e competência com moeda e valor explícitos, sem extrair preço de texto nem usar valor de referência como dívida. Por entrega exige aceite; por hora exige horas canônicas aprovadas/fechadas elegíveis; mensal usa regra contratual explícita e pró-rata configurado; misto exige componentes explícitos sem dupla contagem. Condição de cliente final somente quando prevista; aceite não é recebimento do cliente. Provisão mensal gerencial separada, imutável e fechada em mês encerrado. Título exigível depende dos eventos e da conferência aplicáveis; pagamento continua no fluxo financeiro existente.
4. Integração e entrega: cinco cenários distintos de autorização, concorrência/idempotência, assinatura/revisão/entidade/datas, isolamento de custos, documentos privados, horas/aceite/NF, origem de parcelas e regressões ATS/vendas/folha. Permissões → tipos/lint/testes → build/performance → CI → migrações revisadas → publicação por hash → Ajuda e navegador.

## Regras de integridade

- Assinar, autorizar início, alocar, aceitar entrega, aprovar horas, conferir NF, provisionar, gerar título e pagar são atos separados. Não realizar essas operações em registros reais durante QA.
- Revisionar depois da assinatura não sobrescreve documento histórico. Toda nova autorização liga revisão, hash, atores, datas e justificativa; leitura não escreve.
- Active membership e deny em UI/servidor/RLS/RPC; ações acumulam permissões reais do contrato/pessoa/projeto/financeiro. Novas chaves não concedidas automaticamente. Salário, custo, margem e referência não aparecem em eventos/listas/avisos genéricos.
- Preservar alçadas atuais: a configuração vigente da Área Técnica já possui uma política, não limpá-la nem criar fallback por nome/CEO. Gestor ausente ou sem acesso bloqueia e informa pendência.
- Preservar fluxo de folha/recorrências e contratos históricos. Geradores por pessoa, alocação, contrato e parcela precisam de dono de origem; evidência de legado gera reconciliação explícita, nunca segunda despesa. Não alterar paid_amount/status para simular pagamento, nem cancelar títulos pagos.
- CLT/folha não exige NF fictícia; PJ/fornecedor exige documentação aplicável; freelance exige modalidade documental explícita, sem decidir tratamento fiscal por heurística.
- Uma entrega canônica no projeto, se associada; custos de alocação/rateio são vistas da mesma origem, sem multiplicar despesa. Horas de referência não alteram preço fechado.
- Migrations históricas imutáveis; novos scripts somente preparados até revisão e testes. Nenhum convite, mensagem, assinatura, título ou pagamento real para QA. Ensaios de schema real usam rollback e checagem de resíduos.

## Auditoria inicial

Hiring_engagements exige job_id e model_version_id; hiring_set_live, hiring_allocation_guard, convites e contexto ainda consultam ATS. A adaptação precisa reconhecer a nova origem sem fragilizar as outras. Provisão de custo já permite config_id nulo desde 0318 e possui revisão única por contrato/competência; reaproveitar. Financial_entries já suporta origem contract, payable/open e entidade legal. Folha atual usa financial_recurrences com marcador people_payroll:person_id; tratar antes de gerar títulos de nova contratação para evitar duplicidade.

## Estado

Lote A iniciado. Demais lotes pendentes. Nada do pacote 4 aplicado ou publicado ainda. Evidências operacionais no relatório local outputs/contracting-package4-2026-11-19.
