# CORPO-PDF — corpo do contrato lido no servidor (porte M, ~45–60 min)

## O que foi confirmado
- O PDF da NEXID tem texto de verdade (19 páginas, ~51 mil caracteres). Não é digitalizado.
- O contrato C-202611-2753 foi gravado às 00:43 UTC como importação de PDF, com o arquivo original guardado, mas com o corpo vazio.
- Nada no banco apaga o corpo depois da gravação, e o servidor aceita esse texto (testei o filtro de segurança com o arquivo).
- A leitura do PDF dá certo fora do navegador e também no navegador de teste (Chromium). Ou seja, ela falha só no navegador do usuário, e a falha não aparece porque o erro é descartado. Ainda não sei a causa exata. A suspeita é o leitor de PDF rodando no próprio navegador (Safari/macOS ou bloqueio do "worker" na prévia), mas isso não está confirmado.

## O que muda
1. **O texto do PDF passa a ser lido no servidor.** O arquivo já vai ao servidor para a leitura pela IA. Na mesma chamada, o servidor extrai o texto integral e devolve o corpo pronto. O navegador deixa de depender do leitor de PDF local. O leitor do navegador continua só como reserva.
2. **Erro visível.** Se as duas leituras falharem, o aviso diz o motivo (por exemplo, "PDF sem texto" ou "falha ao ler página X"), em vez de silenciar.
3. **Recuperar contratos já importados.** Na aba Documento, quando o corpo está vazio e existe arquivo original, aparece o botão "Carregar corpo do arquivo original". Ele lê o arquivo guardado no servidor e preenche o corpo, inclusive o C-202611-2753, sem precisar importar de novo. Só funciona em rascunho, para quem pode editar o contrato.
4. **Importação em lote** usa a mesma leitura no servidor para PDFs.

## Detalhes técnicos
- Nova dependência `unpdf` (pdf.js para runtimes edge/Workers, sem binários nativos). Ela só é carregada dentro do handler, com import dinâmico.
- `src/lib/contracts/pdf-body.server.ts`: `extractPdfBodyHtml(bytes)` → `plainTextToBodyHtml` + `fitBodyHtml`, com limite de páginas/tempo e erro tipado.
- `parseContractPdf` passa a retornar `{ extracted, body_html, body_error }`, e o diálogo de importação usa esse corpo primeiro. Se faltar, tenta o `pdfToBodyHtml` local e registra o erro em `console.warn`, sem dados do contrato.
- Nova server fn `reloadContractBodyFromSource({ id })`: `requireWorkPermission("techcontracts.contracts","edit")` + `assertWorkRecord(... "edit")`. Ela só age se `status='draft'`, `body_html` estiver vazio e houver `source_file_path`. O download do arquivo usa o mesmo padrão de `getContractSourceFileUrl` (leitura sob RLS primeiro, admin só para baixar o objeto), e a gravação usa o cliente do usuário (RLS). Não cria permissão nova: reaproveita a edição de contrato. O contrato de permissões será registrado com os cinco cenários.
- DOCX segue igual.
- Testes: `pdf-body.server.test.ts` com o PDF de exemplo, sem dados reais (fixture sintética gerada). Os casos são: texto vira parágrafos, PDF vazio dá erro tipado, e a regra do botão (só rascunho, vazio e com arquivo).
- Ajuda: `docs/help/contracts/importar-contrato.md` passa para a v7 (leitura no servidor + botão de recuperação) e o `official-catalogue.json` é atualizado. Os hashes vão em `permission-contracts.json`.
- Validação: Playwright importando um PDF sintético até o rascunho, conferindo o corpo na aba Documento e testando o botão de recuperação num rascunho vazio. Rodar typecheck dos arquivos alterados, os testes de contratos e `help:coverage`.

## Fora do escopo
- OCR de PDF digitalizado (continua com aviso).
- Publicação.
