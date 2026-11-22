# Consulta CANAIS-INBOX: capacidades (somente leitura, nada executado)

1. PR codex/workflow-inbox-channels -> main
   - A ferramenta nativa de PR so envia a branch de um draft. Ela nao abre PR de uma branch enviada de fora.
   - Caminho possivel: o conector GitHub, chamando a API REST (abrir o PR e ler checks/status da CI). Exige uma conexao GitHub ligada e com acesso ao repo gkologeski/wktechnology. Ainda nao conferi se essa conexao existe. Escritas pedem aprovacao no chat. Nao ha bypass de protecao de branch.
2. Acompanhar a CI: sim, pelo mesmo conector (somente leitura de checks/status).
3. Depois do merge: o Git sync traz main para o projeto, mas nunca aplica migrations.
   - A ferramenta de migration cria um arquivo novo e o aplica com ledger (journal Drizzle). Ainda nao confirmei que ela aplica arquivos pendentes ja versionados sem gerar um novo. A inspecao do historico de migrations (somente leitura) mostraria o que esta pendente antes de qualquer decisao.
   - Se for preciso um arquivo novo, isso altera o repositorio. Nesse caso eu pararia e pediria sua autorizacao.
4. Validacao visual: sim, com Playwright e uma sessao autorizada (a sessao injetada ou a sua propria conta). Nao preciso aceitar o draft drft_01m806skzqe65aq0vwzask9n12.

Nada foi executado, editado ou aplicado nesta consulta.
