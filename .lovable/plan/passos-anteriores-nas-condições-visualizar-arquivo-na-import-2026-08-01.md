# Passos anteriores nas condições + visualizar arquivo na importação de contrato

Duas entregas independentes.

## 1. Condições podem usar a saída de passos anteriores (parte de UI que falta)

O motor já registra a saída de cada passo e já resolve `{{steps.N.campo}}` na avaliação de condições (`src/lib/workflows/engine.server.ts`). O que falta é a superfície no construtor: hoje o seletor de campo da condição só lista propriedades da entidade.

- No seletor de campo das condições (gatilho, ramificação e demais usos de `FilterRow`), passa a existir um grupo separado "Passos anteriores", abaixo do grupo "Propriedades do registro".
- O grupo lista apenas passos que vêm antes do passo atual no fluxo (respeitando ramificação) e, para cada um, as saídas disponíveis: identificador do registro criado, campos preenchidos pelo passo, variáveis de formatação e resultado de aprovação/atribuição.
- Escolher uma dessas opções grava a condição apontando para `steps.N.campo`; passo ainda não executado é tratado como vazio na execução (comportamento já existente do motor).
- Quando o campo escolhido é de passo anterior, o valor de comparação continua aceitando texto com token/pills, sem tentar montar combo de opções de entidade.

## 2. Botão de visualização do contrato na tela de extração por IA

Em `/contracts` → "Importar contrato", após escolher o arquivo (e também na etapa de revisão dos dados extraídos), passa a haver um botão "Visualizar contrato".

- A visualização usa o próprio arquivo já selecionado no navegador (blob local), então funciona antes do contrato existir no banco — sem depender de upload nem de nova chamada ao servidor.
- PDF é exibido em visualizador embutido; DOCX não é renderizável no navegador, então o botão oferece "Abrir/baixar arquivo" e, quando o texto já foi extraído, um preview do texto lido.
- O modal de visualização abre por cima do diálogo de importação e fechá-lo mantém o estado da extração/revisão intacto (nada é reprocessado).
- Estados cobertos: sem arquivo selecionado (botão oculto), arquivo grande carregando, falha ao ler o arquivo com mensagem e ação de repetir.

## Detalhes técnicos

- `src/components/workflows/workflow-builder.tsx`: `FilterRow` recebe as saídas de passos anteriores e renderiza `SelectGroup`/`SelectLabel` para separar "Propriedades do registro" de "Passos anteriores"; helper novo derivando a lista de passos anteriores a partir do estado do fluxo (ordem + ramificações). Sem mudança de tipo de dados salvos: o campo continua uma string.
- `src/components/workflows/step-details-panel.tsx` e usos de `FilterRow` passam o índice/id do passo atual para a filtragem.
- `src/components/contracts/import-contract-file-dialog.tsx`: botão "Visualizar contrato" no cabeçalho da etapa de upload/revisão; novo componente local de preview baseado em `URL.createObjectURL` do `File`, com `revokeObjectURL` no unmount, seguindo o padrão visual de `contract-file-viewer-dialog.tsx` (reaproveitado por composição, sem alterar o viewer atual que depende de `contractId`).
- Sem alteração de schema, RLS, autenticação, server functions ou regra de negócio.

## Validação manual

1. Em `/settings/workflows`, criar fluxo com 2+ passos e, no segundo, abrir a condição e conferir o grupo "Passos anteriores" listando somente passos precedentes.
2. Salvar a condição e executar o fluxo, conferindo que o valor do passo anterior é resolvido.
3. Em `/contracts` → "Importar contrato", selecionar um PDF e clicar em "Visualizar contrato"; fechar e confirmar que a extração/revisão continua igual.
4. Repetir com um `.docx` e confirmar a alternativa de download/preview de texto.
