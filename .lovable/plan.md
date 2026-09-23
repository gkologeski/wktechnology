# Vincular empresas aos contatos Cliente que estão sem empresa

## O que encontrei
O contato aberto (Ricardo Soeltl, carga24h.com.br) está de fato **sem empresa**: não tem empresa vinculada nem nome de empresa escrito. A tela está mostrando o que está no banco.

Dos 38 contatos "Cliente" nessa situação:
- 34 têm uma empresa cadastrada com o mesmo domínio do e-mail (ex.: carga24h.com.br).
- 3 estão em negócios que já têm empresa.
- O restante usa e-mail pessoal (gmail etc.) e não dá para saber a empresa.

## O que vou fazer
1. Vincular cada contato à empresa pelo domínio do e-mail, só quando houver **exatamente uma** empresa com aquele domínio no workspace. Ignorar e-mails pessoais (gmail, hotmail, outlook, yahoo etc.).
2. Para os que sobrarem, usar a empresa do negócio em que o contato participa, só se for uma única empresa.
3. Preencher também o nome da empresa no contato.
4. Mostrar os números no chat (vinculados por domínio, por negócio, sem correspondência) e conferir no navegador que a coluna Empresa aparece com link.
5. Aplicar a mesma regra aos demais contatos do workspace (não só Cliente), com a prévia dos números antes de gravar.

## Detalhes técnicos
- Atualização só de dados em `contacts.company_id`/`company_name`, casando `lower(split_part(email,'@',2)) = lower(companies.domain)` no mesmo `workspace_id`, com `having count(distinct id)=1`; fallback via `deal_contacts` → `deals.company_id`.
- Sem mudança de tela, estrutura do banco ou regras de acesso.
