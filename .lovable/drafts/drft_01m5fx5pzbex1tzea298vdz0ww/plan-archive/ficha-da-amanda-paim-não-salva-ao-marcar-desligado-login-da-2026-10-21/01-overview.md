# Ficha da Amanda Paim não salva ao marcar "Desligado" (login da Priscila)

## O que já foi conferido
- A ficha da **Amanda Paim Guerra** continua **Ativa** no banco; a última gravação é de 18/08. Ou seja, a mudança para Desligado nunca chegou a ser salva.
- A Priscila **tem** a permissão de editar pessoas no workspace inteiro, e a regra do banco que libera a edição aceita essa permissão.
- Nenhuma sessão recente de "Ver como" Priscila (que seria só leitura) foi encontrada. Portanto não é esse o bloqueio.
- Não houve erro registrado no servidor na última hora, e eu não consegui simular a gravação com a identidade dela só pelo banco. **A causa ainda não está confirmada.**

## Plano
1. **Reproduzir de verdade:** entrar na pré-visualização com a sessão da Priscila (isso pede a sua aprovação), abrir a ficha da Amanda, mudar para Desligado e salvar. Vou capturar a mensagem de erro exata e a resposta do servidor.
2. **Achar a causa a partir do erro.** As suspeitas, por ordem:
   - O formulário reenvia campos que a Priscila não pode ver (custos, dados bancários, endereço) vazios ou mascarados, e a gravação recusa.
   - Uma validação do formulário falha ao escolher Desligado, por exemplo com a data de desligamento ou um campo obrigatório.
   - Uma automação disparada pela troca de status falha e desfaz a gravação.
3. **Corrigir só a causa confirmada.** Se for a primeira suspeita, a gravação passa a enviar apenas os campos que a pessoa pode editar, e os dados sensíveis continuam intactos. Não vou mudar permissões, cargos nem o que a Priscila pode ver.
4. **Validar:**
   - Repetir o fluxo com a Priscila e confirmar que a ficha fica **Desligado**.
   - Depois **voltar a ficha da Amanda ao estado anterior**, a não ser que você confirme que ela deve ficar desligada.
   - Repetir também com um administrador.
   - Rodar os testes de pessoas, o typecheck e o build.

## Fora do escopo
Permissões da Priscila em outros módulos, regras de visibilidade e qualquer outra ficha.
