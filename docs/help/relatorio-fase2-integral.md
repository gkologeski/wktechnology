# Fase 2 integral — entrega preparada, não publicada

## 1. Resumo
424 artigos oficiais disponíveis neste rascunho: CRM 118, ATS 46, People 31, Contracts 56, Projects 35, Finance 39, Core 85, Plataforma 14. Preservados os 208 artigos anteriores; três receberam versão editorial nova. Cobertura estática 244/244 telas autenticadas oficiais. Guias internos de páginas públicas também incluídos.

## 2. Escopo
Somente Ajuda, conteúdo, aplicação editorial protegida e verificações. Nenhuma regra operacional, integração externa, permissão Meta, mensagem ou dado de negócio alterado. Cobertura por tela não é certificação de cada fluxo operacional.

## 3. Criados
216 artigos adicionais em docs/help/<módulo>/*.md; quatro relatórios de auditoria; scripts/help-catalogue.ts; src/lib/help/official-catalogue.json; help-release.ts/functions.ts/test.ts; help-catalogue.test.ts; help-phase-two-access.test.ts; src/components/help/help-release-button.tsx; este relatório.

## 4. Alterados
roadmap.md; AGENTS.md (regras técnicas); .github/workflows/ci.yml (gate Ajuda); tests/help-coverage/help-coverage.ts/module-routes.ts/README.md; docs/architecture/help-center.md; docs/help/inventario.md/divergencias.md/pendencias-midia.md/relatorio-techcontracts.md; três artigos anteriores (multi-posting, FAQ ATS, dashboard People); src/lib/help/help-route-match.ts/help.functions.ts; src/routes/_authenticated/ajuda.index.tsx; docs/security/permission-contracts.json; db/seed.sql.

## 5. Removidos
Nenhum.

## 6–7. Revisão e correções
Corrigidas afirmações falsas sobre multi-posting, simulação bancária, parcelas, DRE, recorrências e acesso de serviços. Dúvidas operacionais separadas nos relatórios, sem promessas nos artigos. Rotas escapadas normalizadas; redirecionamentos e ferramenta interna QA excluídos do gate. Desempate contextual estável por ordem/slug. Nenhum baseline regenerado. Migrations existentes preservadas.

## 8. Validações
- bun run permissions:check: aprovado, zero achados.
- bun run help:coverage --json: 244 rotas cobertas, 424 artigos, sem metadados/seções inválidos.
- bunx vitest run com cinco arquivos da Ajuda: 33 testes aprovados.
- bunx vitest run global: 342 arquivos/2556 testes aprovados; 7 arquivos falharam por Docker ausente, 220 testes ignorados. Não é aprovação global.
- ESLint dirigido: sem erros nos arquivos verificados.
- Sinal automático do ambiente: build OK na última consulta; build/typecheck não executados manualmente.
- bun run perf:check: falhou por ausência de .verification/build.json; desempenho não certificado.
- Auditoria de acesso SQL antes/depois: saídas idênticas; sem correção de achados preexistentes.
- Links de artigos: zero destinos ausentes; zero [CONFIRMAR] nos corpos oficiais.
- Playwright autenticado: aplicação de 219 artigos (216 novos e 3 versões novas); repetição 0 atualizados/424 preservados. Leitura Projects/Finance, pesquisa por recorrências e celular light/dark verificadas; sem erros de página e sem overflow horizontal no viewport testado.
- Chamada editorial sem bearer: respondeu 500; teste esperava 401/403 e falhou. Não certificada a semântica HTTP nem os quatro perfis por API real. Testes unitários de negação passaram.

## 9. Testes
Novos: autorização Projects/Finance, desempate e inventário de rotas; autorização editorial em cinco cenários e preservação de versões; paridade catálogo/Markdown. Não são substitutos de testes reais RLS/API por todos os perfis.

## 10. Banco
424 artigos nesta base separada. Sem mudanças de estrutura, GRANT/RLS ou migrations novas nesta etapa. db/seed.sql contém INSERTs idempotentes do catálogo e foi aplicado em uma transação: zero duplicações. Dados deste rascunho não movem para o app. Após aceite, catálogo precisa ser aplicado no app pelo editor autorizado em Atualizar Ajuda oficial. O botão não publica o aplicativo.

## 11. Segurança
Aplicação editorial autenticada, verifica canEditHelp antes de importar catálogo fixo, usa cliente do usuário/RLS, não aceita corpo ou destino do navegador. Sem segredo ou pessoa real no catálogo. Permissões alternativas continuam limitadas por min_permission escalar; não houve ampliação para contornar isso.

## 12. UX/UI
Leitor existente preservado. Atualização editorial com loading, disabled, erro e confirmação; botão oculto para quem não pode editar. Busca/índice/link/feedback existentes. Capturas de leitura desktop e mobile verificadas; não são capturas definitivas de telas operacionais.

## 13–14. Riscos e pendências
Aceite requer revisão/aprovação em outra interação sem edição; não efetuado. Publicação não solicitada nesta etapa, pois este rascunho ainda não foi aceito. Após aceite, aplicar catálogo no app e publicar, conferir leitura real. CI SQL sem Docker, desempenho, testes reais de negação, capturas operacionais e revisão fina de permissão alternativa permanecem pendentes. Relatórios por rota não equivalem à decomposição/teste de todas as funcionalidades complexas. Fase 3 não implementada.

## 15. Validar
Abrir Ajuda; conferir módulos e pesquisa; editor executar Atualizar Ajuda oficial e repetir; conferir versão/body; testar contas autorizadas/negadas e workspace/inativo sem alterar dados de negócio.

## 16. Próximo passo
Revisar e aprovar aceite do rascunho. Aceitar leva alterações registradas de estrutura ao app automaticamente, mas nunca copia os dados próprios deste rascunho. Publicar somente após aceite e aplicação/conferência editorial. Não apresentar esta entrega como publicada ou integralmente certificada.
