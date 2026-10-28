# Importar o restante do Conta Azul (WK Technology)

Estimativa: porte M, cerca de 3–5 h de trabalho + tempo da carga (depende do volume na Conta Azul).

## Situação atual (verificada)
- 28.528 lançamentos vieram de planilha (`contazul:<linha>`), não da API.
- Conexão Conta Azul do WK está **desconectada** desde 26/08/2026; nenhuma sincronização via API registrada.
- A sincronização existente já sabe trazer: categorias, centros de custo, contas bancárias, contas a receber, contas a pagar e extratos.
- Ainda não sabe trazer: clientes/fornecedores e vendas/notas fiscais.

## Etapas
1. **Reconectar** (você): em Configurações › Integrações › Conta Azul, autorizar a conta da WK. Só leitura; nada é alterado na Conta Azul.
2. **Evitar duplicidade com a planilha**: antes de gravar, casar cada lançamento da API com os 28.528 já existentes (data, valor, descrição, contraparte). Casados recebem o identificador da Conta Azul; nada é apagado ou mesclado. Dúvidas vão para uma lista de revisão.
3. **Clientes e fornecedores (novo)**: importar como Empresas/Contatos do Core, casando por CNPJ/CPF, depois e-mail; existentes são só vinculados, nunca sobrescritos.
4. **Vendas e notas fiscais (novo)**: importar vendas e NFS-e emitidas como registros de leitura no TechFinance, vinculados ao cliente e ao lançamento a receber. Nenhuma nota emitida ou cancelada.
5. **Lançamentos novos e extratos**: rodar os passos existentes para trazer tudo após a última carga e os extratos bancários.
6. **Simulação primeiro**: mostrar prévia de quantidades (novos, vinculados, em revisão) antes de gravar; carga real só após sua confirmação.
7. **Relatório final** com totais por tipo e pendências de revisão.

## Garantias
- Somente workspace WK; nada em outros workspaces; nenhum e-mail, cobrança ou nota real.
- Permissões: reutilizar `integrations.manage` para a carga e `finance.*` para leitura; deny e membro ativo respeitados.
- Rollback por execução (registros criados marcados pelo job).
- Sem publicar.

## Detalhes técnicos
- Novos steps `customers`, `suppliers`, `sales`, `invoices` em `contaazul-steps.server.ts` e mapeamento em `contaazul-map.ts` (com testes).
- Casamento planilha↔API em função dedicada com testes de fixtures.
- Possível migration para guardar `external_ref` em vendas/notas e índice único por workspace+entidade+id externo (GRANT/RLS na mesma migration).
- Confirmar endpoints na documentação oficial da API Conta Azul antes de codificar.
- Gates: permissions:check, testes, lint, typecheck, build; Playwright na tela de integração.
