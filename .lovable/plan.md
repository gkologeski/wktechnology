# Destravar a reconexão do Conta Azul e retomar a importação

Porte P (diagnóstico) + M (importação depois). Estimativa: 15–25 min para o diagnóstico; a importação segue o plano anterior após reconectar.

## Situação
A tela do Conta Azul responde "Os dados fornecidos para iniciar esta integração são inválidos". Isso acontece antes do login: o Conta Azul rejeita o identificador do aplicativo ou o endereço de retorno enviados pelo TechERP. Causa ainda não confirmada.

## Passos
1. Rodar o diagnóstico de autorização já existente na tela de integração (somente leitura) e comparar:
   - identificador do aplicativo usado (mascarado) x o cadastrado no Portal do Desenvolvedor Conta Azul;
   - endereço de retorno enviado (`.../api/public/oauth/contaazul-callback`, domínio app.wktechnology.com.br) x o cadastrado no portal;
   - permissões solicitadas e formato do endereço de autorização.
2. Conforme a causa:
   - Endereço de retorno diferente: você cadastra o endereço exato no portal do Conta Azul (eu informo o texto), ou ajusto a configuração do TechERP se o erro for nosso.
   - Credenciais do aplicativo inválidas/expiradas: você atualiza pelo formulário seguro (nunca pelo chat).
   - Erro na montagem do link: corrijo o código com teste cobrindo o formato.
3. Você clica em Conectar de novo; confirmo que a conexão ficou ativa (só leitura).
4. Retomar a importação: prévia de clientes/fornecedores e vendas/notas com novos, vinculados e para revisão, sem duplicar os 28.528 lançamentos da planilha. Carga real só após sua confirmação.

## Regras
Só workspace WK; nada é alterado no Conta Azul; sem publicar; segredos só pelo formulário seguro.
