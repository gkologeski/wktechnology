## Objetivo

Na tela `/people/import-forms`, ao clicar em **Simular**, além dos contadores atuais, exibir uma tabela com as pessoas únicas encontradas na planilha, com **Nome completo**, **Celular** e **prévia da imagem** do anexo "Anexar foto legível do documento de Identificação que conste o CPF frente/verso".

Escopo restrito à simulação (dry-run). Nenhuma alteração no fluxo de execução real, no banco, em RLS ou em permissões.

## Mudanças

### 1. `src/lib/people/import-forms.functions.ts`

- No handler, quando `dry_run=true`, montar e retornar uma lista `people` com os campos mínimos necessários:
  - `full_name`
  - `phone` (já normalizado para E.164 no `normalizeRow`)
  - `cpf_formatted` (útil para o usuário identificar duplicatas)
  - `id_doc_drive_id`: o primeiro `drive_id` cujo `label === "Documento de identidade (CPF/RG)"` (é exatamente o anexo pedido; o rótulo já é atribuído em `normalizeRow` para a coluna "Anexar foto legível do documento de Identificação...").
- Adicionar `people?: Array<{ full_name: string; phone: string | null; cpf_formatted: string; id_doc_drive_id: string | null }>` ao tipo `ImportBatchResult`.
- Sem paginação: são ~171 registros, cabem em uma única resposta.
- Nada muda no ramo de execução real.

### 2. `src/routes/_authenticated/people.import-forms.tsx`

- Estender o card "Simulação" para renderizar uma tabela após a simulação:
  - Colunas: Documento (thumb), Nome completo, Celular, CPF.
  - Thumb: `<img src="https://drive.google.com/thumbnail?id={id}&sz=w200" alt="Documento" />` com `loading="lazy"`, `referrerPolicy="no-referrer"` e placeholder ("—") quando `id_doc_drive_id` for nulo.
  - Reaproveitar os componentes `Table`, `TableHeader`, `TableRow`, `TableCell` já importados.
- Manter os KPIs existentes (Pessoas únicas / Anexos totais). Ajustar o rótulo "Anexos totais" para ficar claro que soma todos os tipos de anexo.
- Não alterar o fluxo de **Executar importação**.

## Observações técnicas

- O endpoint `https://drive.google.com/thumbnail?id=...&sz=w200` funciona para arquivos com compartilhamento "Qualquer pessoa com o link — Leitor" e é servido inline pelo Google (sem CORS bloqueando `<img>`). É o mesmo pré-requisito de publicação já exigido pela importação.
- Nenhuma imagem é baixada no servidor durante a simulação — o navegador do usuário carrega direto do Drive.
- Nenhum impacto em RLS, permissões, banco ou schema.

## Como validar

1. Abrir `/people/import-forms`.
2. Manter a URL padrão da planilha e clicar **Simular**.
3. Verificar que o card mostra ~171 pessoas únicas e uma tabela com Nome, Celular e thumb do documento.
4. Conferir uma linha sem anexo de identidade — deve mostrar "—".
5. Executar em seguida a importação real e confirmar que o comportamento permanece igual ao atual.

## Riscos / pendências

- Se o usuário não publicou a pasta de anexos como "Qualquer pessoa com o link", as miniaturas aparecerão quebradas — o próprio ícone de imagem quebrada já sinaliza. Sem impacto no restante da simulação.
- Nenhum teste automatizado novo; a mudança é apenas de leitura/apresentação.
