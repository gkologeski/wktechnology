# Confirmação formatada, rótulos PT-BR e campos limpos que desaparecem

Três correções independentes, todas de UI/UX.

## 1. Diálogo de confirmação do sistema (fim do alerta do navegador)

Hoje 129 pontos do código usam `confirm()`/`window.confirm()` nativo — por isso aparece a caixa cinza do navegador com o endereço do preview.

- Criar um provedor global de confirmação (`ConfirmProvider` + hook `useConfirm`) baseado no `AlertDialog` oficial do design system, montado uma única vez no layout raiz autenticado.
- API simples: `const confirm = useConfirm()` e `if (!(await confirm({ title, description, confirmLabel, variant: "destructive" }))) return;`
- Estados cobertos: título, descrição, botões Cancelar/Confirmar, variante destrutiva em vermelho, foco visível, fechar por ESC, dark mode.
- Migrar todos os 129 pontos, em lotes por módulo (negócios, contatos, empresas, contratos, tarefas, tickets, prospecção, pessoas, workflows, finanças, admin, dashboards, produtos, catálogo, ATS), preservando exatamente o texto atual de cada pergunta e o comportamento pós-confirmação (invalidação de cache e navegação já existentes não mudam).
- Nenhuma regra de negócio, permissão ou consulta é alterada.

## 2. Campos em inglês no construtor de workflows

O rótulo "Import Confidence" aparece porque a coluna `import_confidence` de contratos não tem rótulo PT-BR cadastrado e o sistema cai no nome técnico humanizado.

- Auditar todas as colunas de `contracts` contra o mapa de rótulos e completar as faltantes (incluindo `import_confidence` → "Confiança da importação (IA)", e demais colunas de importação/IA encontradas na auditoria).
- Classificar as colunas de importação/IA como campos de sistema, para caírem no bloco colapsado "Campos do sistema e integrações", em vez do fluxo principal.
- Rodar a mesma auditoria para as outras entidades usadas em workflows e cadastrar rótulos PT-BR faltantes onde o nome técnico ainda vaza.

## 3. Campo que desaparece ao ser limpo

Ao apagar o conteúdo, a chave é removida do objeto de valores e o campo deixa de ser "preenchido", migrando para a lista de campos vazios (recolhida) — visualmente ele "desaparece".

- Manter no editor de campos extras um registro dos campos que o usuário abriu/editou nesta sessão, e exibi-los sempre na mesma posição, mesmo quando o valor está vazio.
- O valor continua sendo removido do payload salvo (comportamento atual preservado): a mudança é apenas de exibição.
- Campos limpos ganham botão de remover explícito, para quem quiser realmente tirá-los da tela.

## Detalhes técnicos

- Novo: `src/components/ui/confirm-dialog.tsx` (provider + hook, sobre `alert-dialog.tsx`), montado em `src/routes/_authenticated/route.tsx`.
- Rótulos: `src/lib/contracts/workflow-field-meta.ts` (`CONTRACT_FIELD_LABELS`, lista de campos de sistema) e, se necessário, os overrides em `src/lib/entity-fields.functions.ts`.
- Persistência de campos limpos: estado local em `src/components/workflows/extra-fields-editor.tsx` (conjunto de nomes "em edição"), sem tocar em `setKey`/payload.
- Validações: typecheck, lint e testes existentes após cada lote de migração.
