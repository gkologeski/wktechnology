# Entrega documental — TechContracts

## 1. Resumo
52 artigos oficiais preparados e disponíveis neste rascunho. Cobertura: 11/11 telas do inventário, mais artigos relacionados de assinatura, importação, aprovação, vínculos e cobrança.

## 2. Escopo confirmado
Somente Ajuda e Treinamento. Nenhuma funcionalidade de contratos, assinatura, cobrança, integração, autenticação ou permissão modificada. Nenhuma mensagem enviada.

## 3. Arquivos criados
- `docs/help/contracts/*.md`: 52 artigos.
- `drizzle/migrations/0307_help_seed_contracts.sql`: conteúdo idempotente para aceite.
- `db/seed.sql`: artigos novos reaplicáveis em futuros rascunhos, sem dados pessoais ou contas.
- `src/lib/help/help-contracts-access.test.ts`: cinco cenários de leitura.
- Este relatório.

## 4. Arquivos alterados
- `tests/help-coverage/module-routes.ts`: 11 telas do módulo.
- `docs/help/divergencias.md`: fatos e limites encontrados.
- `docs/help/pendencias-midia.md`: 46 capturas previstas.
- `docs/security/permission-contracts.json`: hash e fronteira da nova migration no contrato existente.
- `drizzle/migrations/meta/_journal.json`: entrada acrescentada pelo gerador oficial.
- `roadmap.md`: checklist desta entrega.

## 5. Arquivos removidos
Nenhum.

## 6. Problemas encontrados
Documentados em divergencias.md: diferenças de filtros, limites de consulta, controles locais ausentes, etapas de importação não atômicas, integração de assinatura não comprovada por seletor, ausência de garantia de envio de e-mail e distinções entre estados e geração financeira.

## 7. Correções desta entrega
A aplicação inicial recusou UPDATE pelo papel de execução do rascunho. `db/seed.sql` foi ajustado para INSERT com conflito ignorado: primeira aplicação criou 52 artigos; repetição criou zero. Migration preserva upsert para a entrega. Contrato recebeu referência SQL reconhecível e hash final; formatação do teste corrigida. Nenhum acesso ampliado.

## 8. Validações executadas
- `bun run permissions:check`: aprovado, sem achados.
- `bunx vitest run src/lib/help/help-access.test.ts src/lib/help/help-contracts-access.test.ts`: 13/13.
- `bunx eslint src/lib/help/help-contracts-access.test.ts`: aprovado após correção de formatação.
- `bunx drizzle-kit check`: aprovado.
- `bun run help:coverage --module contracts`: 11/11; 52 artigos, metadados/seções válidos.
- Cobertura anterior preservada: CRM 52/52; ATS 33/33; People 15/15.
- `psql -X -f tests/access-audit/access-audit.sql`: 39 apontamentos preexistentes; saída antes/depois idêntica.
- `psql --single-transaction -f db/seed.sql`: primeira aplicação INSERT 0 52; repetição INSERT 0 0.
- Playwright autenticado: página do módulo e artigos de criação, cobrança, assinatura e permissões abriram, sem Artigo indisponível.
- Links internos dos 52 artigos: nenhum destino ausente. Zero marcadores [CONFIRMAR].
- Compilação automática do ambiente: última entrada consultada build OK. Não executados manualmente typecheck/build completos ou perf:check.

## 9. Testes
Cinco novos testes exercitam o controle real de leitura de artigos do TechContracts: permitido, ausência de chave do módulo, deny, outro workspace e membro inativo. Oito testes existentes da Ajuda preservados.

## 10. Banco e migrations
Somente artigos adicionados neste rascunho. Nenhuma tabela, policy, GRANT ou registro operacional alterado. Nova migration registrada no journal, sem editar migrations anteriores. O nome completo é distinto, mas prefixo 0307 coexiste com uma migration concorrente; gerador e drizzle-kit check aceitam a sequência. Tentativa de renumeração do journal protegido foi recusada; conferir concorrência no aceite. Aceitar leva as mudanças registradas para o app; dados próprios do rascunho não são copiados.

## 11. Segurança e privacidade
Nenhum segredo, credencial, dado real de cliente ou conta de exemplo incluído nos artigos. Mesmas barreiras da Ajuda. Nenhuma concessão de permissão e nenhum efeito externo.

## 12. UX/UI e acessibilidade
Leitor existente preservado: títulos, índice, links, tabelas Markdown e avaliação. Capturas de validação mostram texto e seções sem sobreposição na tela desktop; capturas definitivas de treinamento continuam pendentes. Nenhum redesign.

## 13. Riscos remanescentes
Limites e divergências operacionais foram documentados, não corrigidos nesta frente. Cobertura de telas não significa validação end-to-end de toda operação de contrato. Os 39 apontamentos de acesso são anteriores à entrega.

## 14. Pendências
Imagens definitivas e revisão operacional da equipe. Typecheck/build completos, desempenho e leitura contextual de todas as 11 telas não executados nesta etapa. Não publicado.

## 15. Como validar manualmente
Abra Ajuda > TechContracts. Confira Primeiros 15 minutos, Criar contrato, Configurar cobrança e Registrar assinatura. Compare os passos com as telas reais sem alterar registros para treinamento. Acesso a ações continua sujeito às permissões próprias.

## 16. Próximo passo
Revisar o material do TechContracts; depois, mediante autorização, avançar para TechProjects. Trilhas e quiz não implementados.