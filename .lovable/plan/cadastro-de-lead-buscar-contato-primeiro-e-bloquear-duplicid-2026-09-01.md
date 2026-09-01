# Cadastro de lead: buscar contato primeiro e bloquear duplicidade

## O que foi verificado

- O lead `gustavo@advintegra.com.br` **já existe** no workspace (criado em 31/08 17:57, com empresa ADV Integra e contato vinculados). Ou seja, a nova tentativa era de fato uma duplicata.
- Em `src/components/leads/create-lead-dialog.tsx`, ao escolher "Sim, reaproveitar", `applyContact` grava a empresa como `{ id: null, name: "ADV Integra" }` quando o contato não tem `company_id`. O botão "Criar lead" tem `disabled={... || (!!company.name.trim() && !company.id)}` — por isso, depois de aplicar os dados, **o botão fica desabilitado e nada acontece**.
- A checagem de duplicidade (`checkLeadDuplicate`) só roda no clique em "Criar lead". Como o clique nunca acontece (botão travado), o usuário nunca vê a mensagem de lead duplicado.
- O diálogo de "Contato existente" é um `AlertDialog` aninhado dentro do `Dialog`, disparado por debounce no campo de e-mail — comportamento intrusivo no meio da digitação.

## O que muda

### 1. Buscar contato antes de preencher (novo primeiro passo)

O modal "Criar lead" passa a abrir em uma etapa de busca:

- Um único campo "Buscar contato" (e-mail, nome ou telefone).
- Resultados da base de **contatos** em lista curta, mostrando nome, e-mail e empresa.
- Escolher um resultado leva ao formulário **já preenchido** com nome, sobrenome, e-mail, telefone e empresa do contato — todos editáveis.
- "Criar do zero" (ou nenhum resultado) leva ao formulário **em branco**.
- Remove o `AlertDialog` de "Contato existente encontrado" disparado durante a digitação.

### 2. Impedir lead duplicado de forma visível

- Na etapa de busca, o sistema também procura **leads** com o mesmo e-mail/telefone. Se existir, mostra um aviso claro ("Já existe um lead com este e-mail") com botão "Abrir lead", sem permitir seguir para a criação.
- No formulário, ao sair do campo de e-mail ou telefone, a mesma verificação roda e exibe erro inline no campo, mantendo a checagem final antes do insert (que continua como rede de segurança, junto com o trigger do banco).

### 3. Corrigir o botão travado

- Quando o contato/lead traz apenas o nome da empresa (sem registro vinculado), o formulário passa a resolver a empresa por nome no workspace; se não existir, oferece criar a empresa ali mesmo (fluxo `QuickCreateCompanyDialog` já existente).
- O botão "Criar lead" deixa de ficar silenciosamente desabilitado: quando falta escolher/criar a empresa, a mensagem aparece visível abaixo do campo Empresa, não só como `title`.

## Detalhes técnicos

- Arquivos previstos: `src/components/leads/create-lead-dialog.tsx` (dois passos: busca e formulário), extraindo a busca para `src/components/leads/lead-contact-search-step.tsx` para manter o arquivo enxuto.
- Reuso de `checkLeadDuplicate` (`src/lib/leads/lead-duplicate-check.ts`) na etapa de busca e no blur dos campos; sem alterar sua assinatura.
- Busca de contatos via `supabase.from("contacts")` com `or(email.ilike, first_name.ilike, last_name.ilike, phone.ilike)`, limite 8, respeitando RLS do usuário.
- Sem alteração de schema, RLS, permissões ou regra de negócio. `ensureLeadRelationsSafe` e o restante do fluxo de criação permanecem iguais.
- Estados de loading, vazio e erro na etapa de busca; foco visível, labels acessíveis, tokens semânticos e dark mode conforme o design system.

## Como validar

1. Abrir "Criar lead" e buscar `gustavo@advintegra.com.br`: deve avisar que já existe lead com esse e-mail e oferecer abrir o lead existente.
2. Buscar um contato sem lead: o formulário abre preenchido e editável, e o botão "Criar lead" funciona mesmo quando a empresa vem só como nome.
3. Buscar algo sem resultado e escolher "Criar do zero": formulário em branco.
4. `bun run typecheck`, `bun run lint`, `bun run test`.
