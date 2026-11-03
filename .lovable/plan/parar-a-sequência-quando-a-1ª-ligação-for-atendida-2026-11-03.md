# Parar a sequência quando a 1ª ligação for atendida

Porte P, cerca de 40–60 min. Depende da publicação do app para valer no sistema em produção, incluindo a correção do "atendida", que ainda não foi publicada.

## O que muda para você
- Depois da Ligação 1, a sequência confere o resultado da ligação:
  - **Atendida:** a sequência termina e a conversa passa para uma pessoa (você), sem a 2ª ligação.
  - **Não atendida, ocupada, caixa postal ou falha de conexão:** segue para a espera e a Ligação 2.
- Hoje, uma ligação com falha de conexão travaria essa verificação como "resultado desconhecido". Ela passa a contar como "não atendida", porque não houve conversa.

## Passos
1. Na sequência de teste "Outsourcing TI — Gestores de TI (teste)": salvar uma nova revisão com o passo "Verificar se a ligação foi atendida" logo após a Ligação 1 (Sim → encaminhar para pessoa; Não → seguir). Criar a versão nova.
2. Aplicar o mesmo passo na sequência original "Outsourcing TI — Gestores de TI", também como nova revisão em rascunho. Nada é iniciado.
3. Ajustar a regra para que uma ligação com falha conte como resultado conhecido (não atendida), em vez de travar.
4. A sua execução atual (pausada antes da 2ª ligação): como a Ligação 1 foi atendida, ela é encerrada e encaminhada para pessoa, sem a 2ª ligação.
5. Testes: atendida → para; não atendida → 2ª ligação; falha → 2ª ligação. Rodar os testes das sequências, a checagem de permissões e o ESLint.

## Detalhes técnicos
- O passo `condition` com `criteria: "call_answered"` já existe no editor e no motor (`draft.ts`, `runtime.ts`), com os ramos `yes: "human"` e `no: "next"`.
- `callResultKnown` vem do banco (`prospecting_sequence_context`, migrations 0297/0299) e hoje só aceita `answered`/`no_answer`. Uma nova migration aditiva recria a função incluindo `failed` como conhecido. As migrations antigas não são alteradas.
- O contrato de permissões é atualizado se algum arquivo coberto mudar. Nenhuma permissão nova.
- Não haverá publicação sem pedido seu.
