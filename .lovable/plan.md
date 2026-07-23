
## Objetivo

Extrair as respostas do formulário público (planilha `1J9Tqg7JOehajxk3tfWPodCSK1wI58Iijk2vFcksaiFE`, 200 linhas → ~171 pessoas únicas), normalizar os campos e cadastrar cada pessoa em `public.people` do TechPeople, baixando cada documento anexado do Drive público e vinculando-o em `public.people_documents`.

## Verificações já feitas

- Baixei o CSV público (200 linhas de dados, 34 colunas). Confirmei o schema: Carimbo, CNPJ, Razão Social, Nome Fantasia, Optante Simples, Nome Completo, CPF, RG, Data Nascimento, Endereço, Complemento, Cidade, UF, CEP, Email, Recado, Celular, Instrução, Banco/Agência, Agência, Conta, Camiseta, 4 links de documentos (Drive), Chave Pix, Instagram, LinkedIn, Como gosta de ser chamado, Endereço de e-mail, Situação Civil, Cônjuge, Carta desligamento.
- Confirmei que `drive.google.com/uc?export=download&id=...` responde 303 → download direto para os arquivos anexados (pasta pública propaga permissão para os arquivos).

## Escopo

- Owner das pessoas criadas: o usuário logado; workspace: workspace ativo do usuário.
- Dedupe: chave primária **CPF** (normalizado, só dígitos). Fallback: e-mail. Estratégia = **atualizar apenas campos vazios** (o dado do sistema tem prioridade sobre o do formulário).
- Anexos: baixar de cada linha os até 4 links do Drive e anexar como `people_documents` (bucket já usado pelo módulo).

## Entrega

### 1. Migration — nenhuma nova estrutura

Nenhuma alteração de schema. A importação só grava em `people` e `people_documents` (já existentes) e no bucket de documentos do TechPeople.

### 2. Server function de importação em lote (`src/lib/people/import-forms.functions.ts`)

Nova server fn `importPeopleFromPublicSheet`, protegida por `requireSupabaseAuth` + `assertAnyPermission("techpeople.people.manage.workspace")`. Fluxo:

1. Baixa o CSV via `fetch("https://docs.google.com/spreadsheets/d/<ID>/export?format=csv")` (URL parametrizada).
2. Parseia com `papaparse` (já usado em `csv-import.functions.ts`).
3. Normaliza cada linha:
   - CPF/CNPJ: `stripCNPJ`-style (só dígitos), valida checksum; linhas com CPF inválido caem em `skipped_invalid`.
   - Telefone/celular: `toE164` com default BR (helper em `validators.ts`).
   - Email: `isEmail`; usa a coluna "E-mail:" com fallback para "Endereço de e-mail".
   - Data nascimento: `dd/MM/yyyy` → ISO.
   - Endereço: monta `address_line1`, `city`, `state`, `zip`, `complement` nos campos correspondentes em `people`.
   - Banco: parse "260 - Nubank" → separa nome/código; agência/conta em texto.
   - Redes sociais: extrai `instagram_handle` e `linkedin_url`.
   - Guarda o restante (razão social, nome fantasia, optante simples, camiseta, chave PIX, cônjuge, "como gosta de ser chamado") em `custom_fields` JSONB para não perder dado.
4. Dedupe por CPF dentro do workspace (batch SELECT `people` por `cpf IN (...)`). Para conflitos: `UPDATE` apenas colunas hoje `NULL` no banco (estratégia "empty-fill").
5. Insere/atualiza `people` em chunks de 100.
6. Para cada linha bem-sucedida, dispara `importAttachments(personId, links[])` em fila de concorrência 4.
7. Retorna resumo: `{ created, updated, skipped_invalid, skipped_duplicate_no_change, attachments_ok, attachments_failed }`.

### 3. Download e anexação de documentos (`importAttachments`)

Para cada link `drive.google.com/open?id=<FILE_ID>` ou `.../file/d/<FILE_ID>/...`:

1. Extrai `fileId` via regex.
2. `fetch("https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t")` seguindo redirects. Trata a página HTML de "arquivo grande" (fallback com token `confirm`).
3. Detecta MIME/nome via `Content-Type`/`Content-Disposition`; se ausente, infere pela extensão do payload (`.pdf`, `.jpg`, `.png`).
4. Faz upload no bucket de documentos do TechPeople usando `supabaseAdmin.storage` no path `people/<personId>/forms-import/<fileId>-<slug>.<ext>`.
5. Insere linha em `people_documents` com `person_id`, `name` (rótulo semântico: "Documento de identidade", "Comprovante de endereço", "Foto marketing", "CPF/RG/Comprovante"), `storage_path`, `mime_type`, `size`, `source = "form_import"`.
6. Erros individuais não abortam a importação — são acumulados em `attachments_failed` com motivo.

### 4. UI de disparo (`src/routes/_authenticated/people/import-forms.tsx`)

Página nova acessível em **TechPeople → Importar do Google Forms** (adicionar item no `menu-config-people.ts`, grupo "Pessoas"). Componentes: `PageHeader`, `Card` com input do link da planilha (pré-preenchido com o link atual), botão **Simular** e botão **Executar importação**. Ambos chamam a mesma server fn — `dryRun: true` na simulação só retorna contagens sem gravar. Mostra `LoadingSkeleton` durante execução e resumo final em `Card` com contagens + tabela de linhas rejeitadas.

### 5. Validação manual

1. Abrir `/people/import-forms`, clicar **Simular** → conferir `parsed=200`, `unique_cpf≈171`.
2. Clicar **Executar** → aguardar (~2-5 min pelos downloads dos anexos).
3. Ir em `/people`, filtrar por `source = form_import` (badge no card) → conferir 171 pessoas.
4. Abrir uma pessoa aleatória → aba **Documentos** → conferir anexos baixados e visualizáveis.
5. Reexecutar a importação → conferir `created=0`, `skipped_duplicate_no_change ≈ 171`, e que campos preenchidos manualmente não foram sobrescritos.

## Fora do escopo

- Não altera schema de `people` nem `people_documents`.
- Não altera RLS/permissões.
- Não modifica UI existente da ficha 360°.
- Não sincroniza continuamente com o Google Forms — é uma importação idempotente sob demanda.
- Empresas (CNPJ/Razão) não viram registros em `companies` nesta rodada; ficam em `custom_fields` da pessoa e podem virar uma rodada seguinte (via `csv-import.functions.ts`).

## Riscos e pendências

- **Anexos privados**: se algum dos 4 links de uma linha estiver com permissão restrita (não herdando da pasta pública), aquele documento vai para `attachments_failed`. A pessoa é criada mesmo assim.
- **Volume**: 171 × até 4 downloads = ~684 arquivos. O worker tem timeout — a server fn processa em blocos e retorna `resume_cursor` se estourar 5min; a UI reexecuta automaticamente até `done: true`.
- **CPFs inválidos**: linhas com CPF corrompido ("Não abri ainda", número truncado) são rejeitadas e listadas no resumo para tratamento manual.
- Depende da planilha e pasta continuarem públicas até a execução terminar.
