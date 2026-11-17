# AGENTE-DO-NUMERO — agente fixado pelo número da campanha

**Porte P/M · estimativa 1h30–2h** (código + testes + Ajuda + validação no navegador). Sem mudança no banco.

## O que muda para você
- Ao escolher o **número remetente** na campanha de WhatsApp, o campo **"Agente SDR após resposta"** é preenchido sozinho com o agente ligado a esse número em Canais de Atendimento (ex.: 6136-9512 → Bruna; 6136-9564 → Maria).
- O campo fica **travado** (somente leitura), com o aviso: "Definido pelo canal de atendimento do número. Para trocar, altere em Canais de Atendimento."
- Se o número não tiver agente ativo para campanhas, o campo mostra "Sem agente neste canal" e a campanha só pode ser salva com o agente **Desligado** (as respostas vão para a distribuição humana configurada).
- Remetente "Lovable" (sem número próprio) ou número sem canal configurado: mantém a escolha livre de hoje.
- Ao abrir uma campanha antiga com agente diferente do canal, o formulário mostra o agente correto do número e avisa que será corrigido ao salvar.

## Proteção no servidor
Ao criar ou editar a campanha, o servidor confere o vínculo do número e **recusa** agente diferente do canal ("O agente desta campanha precisa ser o do número escolhido"). Assim, nem por chamada direta é possível repetir o caso da Eduarda/Bruna.

## Fora do escopo
- Não altero a campanha em andamento ("Prospecção Gerentes TI Empresas sem Software") — ajuste pelo próprio formulário depois de publicado.
- Não mudo os vínculos dos canais, a distribuição para membros nem campanhas de voz/e-mail.
