# Auditoria: campos derivados CRM

Leitura agregada WK em 16/10/2026, sem PII. Não houve implantação dos candidatos abaixo.

| Campo candidato                 |  Total | Preenchidos | Distintos | Cobertura | Utilidade e prioridade | Risco/critério recomendado                                                                 |
| ------------------------------- | -----: | ----------: | --------: | --------: | ---------------------- | ------------------------------------------------------------------------------------------ |
| companies.industry              | 32.044 |      30.209 |       167 |    94,27% | P1 setor agrupado      | Taxonomia versionada PT/EN; preservar setor original, nunca inferir cargo                  |
| companies.state                 | 32.044 |      27.906 |       615 |    87,09% | P1 região              | Padronizar país+UF; muitos valores internacionais, não presumir Brasil                     |
| companies.country               | 32.044 |      30.884 |       154 |    96,38% | P1 região              | País canônico antes de macroregião; desconhecido explícito                                 |
| companies.annualrevenue         | 32.044 |      24.956 |     3.182 |    77,88% | P2 faixa faturamento   | Moeda/período não confirmados; não propor valores monetários até confirmar                 |
| deals.value                     |  1.795 |       1.795 |       473 |      100% | P2 faixa valor         | Separar por currency, obter quantis dentro da moeda; limites exigem decisão                |
| contacts.score                  | 51.144 |      51.144 |         1 |      100% | P3 prioridade          | Sem discriminação atual; nenhuma faixa útil antes de validar scoring                       |
| leads.score                     |  5.924 |       5.924 |         6 |      100% | P3 prioridade          | Não inventar limiar; auditar origem/regras/denominador                                     |
| companies.score                 | 32.044 |      32.044 |         2 |      100% | P3 prioridade          | Pouca discriminação; primeiro validar significado                                          |
| financial_entries.amount        | 28.531 |      28.531 |     7.789 |      100% | P2 faixa financeira    | Moeda e direção obrigatórias; mesmas unidades e limites aprovados                          |
| financial_entries.due_date      | 28.531 |      28.531 |     2.772 |      100% | P1 aging               | Cálculo dinâmico: a vencer, 1–30, 31–60, 61–90, >90 dias; somente aberto, não materializar |
| projects.progress               |      2 |           2 |         1 |      100% | P3 progresso           | Amostra insuficiente; usar status já existente                                             |
| contracts.total_value           |     64 |          64 |        27 |      100% | P2 faixa contratos     | Moeda e anual/mensal não misturados; critérios antes da implantação                        |
| contracts.ends_at               |     64 |          41 |        11 |    64,06% | P1 renovação           | Dinâmico: vencido, 0–30,31–60,61–90,>90 dias; null = sem término informado                 |
| ats_candidates.current_position |     14 |          14 |        13 |      100% | P2 cargo ATS           | Não aplicar regras CRM sem revisar domínio e consentimento                                 |
| ats_candidates.score            |     14 |           0 |         0 |        0% | P3 prioridade          | Sem dados; não criar faixa                                                                 |

## Base de cargo/porte antes

Contatos ativos 51.144; Cargo preenchido 41.685; 14.721 distintos (inclui diferenças crus de espaços/case). Leads ativos 5.924; fontes legadas preenchidas 5.103; 1.706 distintos. Empresas ativas 32.044; size preenchido 30.493; 531 distintos.

## Resultado atual e limitações

Migrações 0142/0143 e backup aplicados. Última leitura confirmada após primeiros lotes: 12.200 Contatos classificados, 4.000 Leads classificados e 2.000 Empresas com porte preenchido. Lotes posteriores retornaram sucesso, mas cobertura final não foi confirmada devido à indisponibilidade recorrente da conexão. Não usar esses números como conclusão final.

Faixas: 0–50,51–100,101–200,201–500,501–1.000,1.001–5.000,5.001–10.000,>10.000. Não são classificação legal de empresa. Cargo desconhecido = Não classificado; vazio = NULL; ambiguidade explícita. Não foi feito perfil de faturamento por moeda/quantis, nem proposta monetária arbitrária.

## Validação realizada

- 73 assertions SQL isoladas; nenhuma escrita compartilhada usada nas assertions.
- `bunx vitest run`: 147 arquivos, 1.004 testes passaram.
- `bun run lint`: 0 erros, 1.325 avisos existentes/gerais.
- Compilação e tipos: sinais do harness `build OK`; não executar build/typecheck manual redundante no sandbox. `verify` composto não executado manualmente por essa restrição.
- Playwright autenticado abriu /contacts, mas mostrou base vazia durante indisponibilidade; não conta como prova end-to-end dos novos valores. Sem campanha, envio, publicação ou chamada externa de enriquecimento.

## Pendências essenciais

Recuperar acesso e concluir backfill; conferir cardinalidade/cobertura final por Cargo/Área/Nível e faixas; comprovar fontes/updated_at/ausência de efeitos via backup, outros workspaces intactos, REST autenticado e browser com dados reais. Não publicar até verificação do usuário.
