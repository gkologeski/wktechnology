## Problema

O wizard de importação mantém a extração da IA apenas em estado React local (`fields`, `kind`, `file`, `sourceFilePath` em `ImportContractFileDialog`). Quando você trocou de aba do navegador e voltou, o preview do Lovable recarregou (log confirma `vite-error-overlay` + full DOM snapshot) e o componente desmontou — o rascunho extraído sumiu. O contrato **nunca chegou a ser inserido** em `public.contracts` (só existe 1 linha no banco, de julho, sem `imported_from`), porque o `INSERT` só acontece no passo 3 quando você clica em "Criar contrato".

## Correção

Trocar o modelo do wizard de "extrai → revisa → só então cria" para "extrai → **cria rascunho imediatamente** → revisa/edita". Assim, mesmo que o modal feche, o contrato existe como `draft` em `/contracts` e pode ser retomado pela lista/detalhe.

### Mudanças

1. **`src/components/contracts/import-contract-file-dialog.tsx`**
   - Depois que `parseContractPdf` / `parseContractText` retorna com sucesso, chamar imediatamente `createContractFromImport` (não esperar o botão do passo 3). Guardar o `id` retornado no estado.
   - Passo 3 vira "Revisar e finalizar": os campos editam o rascunho já persistido via `updateContract` (autosave com debounce, como no `QuoteWizard`), e o botão final apenas fecha o modal e navega para `/contracts/$id`.
   - Se o usuário fechar o modal antes de concluir, o rascunho continua acessível em `/contracts` com status `draft` e badge/etiqueta indicando origem "importado".
   - Backup adicional: espelhar `id`+`fields` em `sessionStorage` (chave `contract-import-draft`) para reabrir o wizard no mesmo ponto se a página recarregar antes do autosave inicial.

2. **`src/routes/_authenticated/contracts.index.tsx`**
   - Adicionar uma pequena etiqueta "Importado" ao lado do número quando `imported_from` estiver preenchido, para o usuário achar o rascunho recém-criado sem precisar do redirect.
   - Nenhuma outra mudança de filtro/consulta (o rascunho já apareceria hoje — o problema é que nunca foi inserido).

3. **Sem migrations, sem alterações de RLS/permissões, sem alterações no `createContractFromImport`/`updateContract`** — o schema e as server functions já suportam esse fluxo (colunas `imported_from`, `source_file_path`, `import_confidence` já existem e o `patchInput` do `updateContract` aceita os novos campos).

### Fora de escopo

- Reprocessar tentativas anteriores (não há linhas para recuperar — nada foi salvo).
- Mudar o comportamento do upload do arquivo original em Storage (permanece igual: sobe em `contract-imports` antes do INSERT).
- Retomar rascunhos "em extração" (se a IA falhar antes de retornar, não há o que persistir).

### Como validar

1. Abrir `/contracts` → "Importar contrato" → subir um .pdf/.docx.
2. Após a extração da IA, verificar toast "Rascunho criado" e que já aparece na lista `/contracts` com status "Rascunho" + etiqueta "Importado".
3. Fechar o modal / trocar de aba / recarregar — o rascunho continua em `/contracts`.
4. Reabrir pelo detalhe, ajustar campos, salvar.