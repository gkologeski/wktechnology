# Importação de contrato: extração no visualizador, progresso e dados na tela

## Estado atual (verificado)

Boa parte do pedido já existe em `src/components/contracts/import-contract-file-dialog.tsx`:

- A extração por IA já roda (`parseContractPdf` para .pdf, `parseContractText` para .docx).
- Os campos extraídos já populam automaticamente o formulário do passo de revisão.
- Já existe salvamento: no fim da extração é criado um rascunho (`createContractFromImport`) e o botão "Finalizar" grava os campos no registro e navega para `/contracts/$id`.
- O visualizador local (`local-file-viewer-dialog.tsx`) hoje só mostra o arquivo: não dispara extração, não mostra progresso e não exibe os dados extraídos.

O que falta é: progresso/status durante a extração e a integração da extração + exibição dos dados dentro do visualizador.

## O que será feito

### 1. Estado de progresso centralizado no wizard

No diálogo de importação, substituir o booleano `parsing` por um estado de fases com rótulo e percentual estimado:

1. Preparando arquivo (5%)
2. Extraindo texto do documento (25%) — .docx via mammoth; .pdf enviado direto ao modelo
3. Analisando com IA (55%)
4. Guardando arquivo original (80%)
5. Criando rascunho (95%) → Concluído (100%)

Renderizar no passo de upload um bloco com `Progress` (componente shadcn existente), o rótulo da fase atual e uma linha de status secundária. Em caso de erro, mostrar `ErrorState`/bloco de erro com a fase em que falhou e botão "Tentar novamente" (reexecuta a extração com o mesmo arquivo).

### 2. Extração dentro do visualizador

O `LocalContractFileViewerDialog` passa a receber props opcionais:

- `progress` (fase + percentual + mensagem)
- `extracted` (campos já extraídos) e `error`
- `onExtract` (dispara a mesma rotina do wizard)

Layout do visualizador em duas colunas em telas grandes (empilhado no mobile):

- Esquerda: o documento (PDF inline, ou texto extraído/aviso para .docx) como hoje.
- Direita: painel "Dados extraídos" com:
  - antes de extrair: estado vazio + botão "Extrair com IA";
  - durante: barra de progresso e mensagens de fase (mesmo estado do wizard, sem duplicar lógica);
  - depois: lista de leitura dos principais campos (título, papel, contraparte/CNPJ, vigência, valores, pagamento, reajuste, multa, escopo, foro, assinatura), badge de confiança e avisos;
  - botão "Salvar contrato" que executa o mesmo `submit` do wizard (atualiza o rascunho e navega para `/contracts/$id`).

Assim a extração pode ser disparada e acompanhada tanto do wizard quanto do visualizador, sempre com o mesmo estado compartilhado (elevado no componente pai).

### 3. Consistência de dados

- O texto extraído do .docx continua alimentando o preview do visualizador.
- Para .pdf, quando a IA retornar, os dados aparecem no painel mesmo que o preview do documento seja o iframe.
- Fechar o visualizador não perde nada: estado vive no wizard.

## Detalhes técnicos

- Arquivos alterados: `src/components/contracts/import-contract-file-dialog.tsx` (estado de progresso, props para o visualizador, reuso de `submit`) e `src/components/contracts/local-file-viewer-dialog.tsx` (layout em 2 colunas, painel de dados extraídos, progresso, CTA de extrair/salvar).
- Sem alteração de schema, RLS, server functions ou regra de negócio: apenas UI/apresentação reutilizando `parseContractPdf`, `parseContractText`, `createContractFromImport` e `updateContract`.
- Componentes oficiais: `Progress`, `Button`, `Badge`, `Dialog`, `Separator`, tokens semânticos; sem cores hardcoded.
- Acessibilidade: `aria-live="polite"` nas mensagens de status, `aria-valuenow` via `Progress`, rótulos nos botões, foco visível preservado; responsivo e válido em light/dark.

## Como validar

Em `/contracts` → "Importar contrato": escolher um .pdf, abrir "Visualizar contrato", clicar "Extrair com IA" e acompanhar a barra e as mensagens; ao terminar, conferir os campos no painel direito e usar "Salvar contrato" — deve abrir o contrato criado. Repetir com um .docx.
