# Busca de contato não encontra "Gustavo Madureira Silveira"

## O que foi confirmado na base

- O contato existe: **Gustavo / Madureira Silveira** (gmsilveira1980@gmail.com), já vinculado à empresa **NEXID LTDA**.
- Ao digitar o nome completo, a busca do seletor de contatos procura no banco por **qualquer uma** das palavras
  (gustavo *ou* madureira *ou* silveira), traz no máximo **50 registros sem ordenação** e só depois, já na tela,
  exige que **todas** as palavras apareçam.
- Existem **608 contatos** que batem com pelo menos uma dessas palavras. O contato certo simplesmente não entra
  nos 50 primeiros, então a tela conclui "Nenhum contato encontrado" mesmo com ele cadastrado.

Ou seja: não é permissão nem dado faltando — é a forma como a busca é enviada ao banco.

## O que muda

1. **Busca exige todas as palavras já no banco.** Cada palavra digitada passa a ser uma condição obrigatória
   (nome, sobrenome, e-mail, telefone ou celular), em vez de filtrar depois de um recorte de 50 registros.
   Assim "Gustavo Madureira Silveira" encontra o contato independentemente do tamanho da base.
2. **Contatos da empresa vinculada aparecem primeiro.** Quando o card já tem empresa associada (caso do NEXID),
   os contatos dessa empresa passam a ser sugeridos no topo, inclusive antes de digitar qualquer coisa.
3. **Tolerância a espaços e acentos sobrando** no nome cadastrado, para não perder registros por formatação.
4. A ordenação por relevância, o limite de resultados, o botão "Criar novo" e a mensagem de vazio continuam
   como estão hoje.

## Detalhes técnicos

- `src/components/ui/contact-picker.tsx`: substituir o `.or()` único e amplo por um `.or()` por token
  (encadeados = AND no PostgREST), mantendo o refino/ordenação em memória apenas para pontuar relevância.
  Normalizar o termo com `trim` e colapso de espaços.
- `ContactPickerPopover` recebe uma prop opcional `companyId`; quando informada, faz uma consulta adicional
  de contatos daquela empresa (limit 10) e os exibe como "Contatos desta empresa" antes/junto dos resultados.
- `src/components/record/associations/company-cards.tsx` (`ContactsCard`, `SingleContactCard`) passa o
  `companyId` do registro ao seletor. Sem mudança de schema, RLS, permissões ou regra de negócio.
- Índice trigram já existente em `contacts` continua sendo usado pelas condições `ilike`.

## Como validar

1. Em uma empresa/negócio, abrir "Contatos → Adicionar" e digitar "Gustavo Madureira Silveira": o contato aparece.
2. Digitar apenas "madureira silveira" e "gmsilveira": também aparece.
3. Abrir o seletor no registro do NEXID sem digitar nada: o contato da empresa aparece sugerido.
4. Rodar `bun run typecheck`, `bun run lint` e `bun run test`.
