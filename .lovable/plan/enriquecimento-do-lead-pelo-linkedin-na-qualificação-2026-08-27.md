# Enriquecimento do lead pelo LinkedIn na qualificação

## Situação atual (verificada)

- A tela de qualificação já roda uma cascata de enriquecimento (`enrichLeadForQualification` → `runApolloCascade`), com cache de 30 dias em `leads.custom_fields.apollo_enrichment`, gravação apenas de campos vazios e badges de status.
- A cascata **já aceita** `linkedin_url` como sinal de maior prioridade em `people/match` (LinkedIn > e-mail > nome + domínio).
- Porém o LinkedIn hoje só é lido do **contato convertido** (`contacts.linkedin_url`). A tabela `leads` **não tem** coluna de LinkedIn (confirmado no schema: só `custom_fields`), então na maioria dos leads novos — ainda sem contato vinculado — o LinkedIn nunca chega ao provedor e o enriquecimento cai no caminho fraco (nome + domínio) ou avisa "sem dados suficientes".

Ou seja: o motor existe; falta o campo do LinkedIn no lead e a UI para informá-lo na hora da qualificação.

## O que será feito

### 1. Campo de LinkedIn no lead

- Migration: adicionar `linkedin_url text` em `public.leads` (aditivo, nulo permitido). Sem mudança de RLS, GRANT ou políticas — a tabela já é coberta.
- Normalização no servidor: aceitar colagens do tipo `linkedin.com/in/xxx`, `www.`, `http://`, com parâmetros de rastreio (`?utm_...`, `?originalSubdomain=`) e converter para a forma canônica `https://www.linkedin.com/in/<slug>`. URLs que não sejam de perfil pessoal (`/company/`, `/posts/`, busca) são rejeitadas com mensagem clara.

### 2. UI na qualificação

- No cabeçalho do painel de qualificação, um campo "LinkedIn do contato" com label acessível, ícone, placeholder de exemplo e botão "Enriquecer pelo LinkedIn".
- Estados cobertos: vazio (dica de que o LinkedIn é o sinal mais preciso), inválido (erro inline), enriquecendo (spinner), sucesso (badge "Apollo · via LinkedIn" e "gravado"), aviso do provedor e "nenhum dado novo".
- O valor é salvo no lead ao confirmar e propagado ao contato vinculado (`contacts.linkedin_url`) quando estiver vazio.
- Se o LinkedIn informado for diferente do usado no último enriquecimento, o cache é ignorado automaticamente (não é preciso clicar em "Enriquecer" duas vezes).

### 3. Motor de enriquecimento

- `enrichLeadForQualification` passa a resolver o LinkedIn nesta ordem: `leads.linkedin_url` → `contacts.linkedin_url` → nada; e aceita um `linkedinUrl` opcional na chamada (o que o usuário acabou de digitar), gravando-o no lead antes de consultar.
- O resultado guarda qual sinal foi usado (`linkedin` | `email` | `name_domain`) para a UI mostrar a procedência.
- Campos preenchidos automaticamente continuam os mesmos já mapeados, agora com muito mais chance de acerto: no lead (nome, sobrenome, e-mail, telefone, celular, empresa), no contato (cargo, LinkedIn, Twitter, endereço, cidade, estado, país, CEP) e na empresa (domínio, site, setor, tamanho, telefone, endereço, página do LinkedIn).
- Regra mantida: só grava campo vazio; nada é sobrescrito sem ação explícita do usuário.

### 4. Grid e detalhes do lead

- O LinkedIn aparece como coluna opcional no grid de leads e como link (abre em nova aba, `rel="noopener"`) na tela de detalhes, para não ficar um dado invisível.

## Detalhes técnicos

- Migration: `ALTER TABLE public.leads ADD COLUMN linkedin_url text;` — sem GRANT/RLS novos (tabela existente).
- Arquivos previstos: `src/lib/prospecting/qualification-enrichment.functions.ts` e `.server.ts` (sinal do LinkedIn, gravação, procedência), novo `src/lib/prospecting/linkedin-url.ts` + teste unitário de normalização, `src/components/prospecting/qualification-panel.tsx` (campo e badges), `src/components/leads/use-lead-columns.tsx` e `src/routes/_authenticated/leads.$id.tsx` (exibição).
- Provedor: o enriquecimento por LinkedIn usa a conexão Apollo.io já existente (`people/match` com `linkedin_url`). A API pública do LinkedIn não permite ler perfis de terceiros, então o LinkedIn é a **chave de busca**, não a fonte — sem nova credencial.
- Custo: cada enriquecimento consome crédito Apollo; o cache de 30 dias e o disparo manual continuam limitando o consumo.
- Validações a rodar: `bun run lint`, `bun run typecheck`, `bun run test`.

## Fora do escopo

Não altera o cálculo de score, o questionário, as regras de conversão em negócio, RLS/permissões nem o enriquecimento em lote de contatos.
