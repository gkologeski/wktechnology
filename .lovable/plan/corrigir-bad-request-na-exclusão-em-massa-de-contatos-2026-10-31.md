# Corrigir "Bad Request" na exclusão em massa de Contatos

Estimativa: porte P, 25–40 min.

## Causa (confirmada no código)
A exclusão em massa de Contatos manda os 1.338 identificadores de uma vez, dentro do endereço da chamada ao banco (cerca de 50 mil caracteres). O servidor recusa endereços desse tamanho e devolve "Bad Request". Nada é apagado.

Empresas já usa o envio em partes; Contatos não usa.

## O que muda
1. A exclusão em massa de Contatos passa a usar o mesmo mecanismo de Empresas: envia em partes de até 100 registros.
2. Durante a exclusão aparece o andamento ("Excluindo 300 de 1.338…").
3. Se uma parte falhar ou alguns registros não tiverem permissão, a mensagem informa quantos foram excluídos e quantos não, em português, sem "Bad Request".
4. Ao terminar, a lista é atualizada e a seleção é limpa.
5. Confirmo se Leads e Negócios usam o mesmo caminho problemático e, se usarem, aplico a mesma correção.

## O que não muda
Quem pode excluir continua igual: a permissão de exclusão e as regras do banco seguem valendo para cada registro.

## Verificação
- Testes do mecanismo de envio em partes, incluindo uma falha no meio e permissão parcial.
- No navegador, excluir em massa um grupo de contatos de teste criados para isso, nunca contatos reais.
- Checagem de tipos e checagem de permissões. Publicação só com o seu aceite.

## Detalhes técnicos
- `contacts.tsx` `bulkDelete`: trocar `.delete().in("id", ids)` por `deleteRowsGuarded("contacts", ids, { onProgress })` e `partialDeleteMessage`.
- `delete-guard.ts`: lote de 200 para 100 (limite seguro de URL e de tempo das regras do banco), com callback opcional de progresso.
- Atualizar o contrato de permissões dos arquivos alterados.
