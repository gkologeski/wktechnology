# PAPEIS-AGENTE — Responsável humano e dono da agenda, um abaixo do outro

Porte: P · Estimativa: 1h30 a 2h (inclui Ajuda, permissões e teste na tela)

## Por que só aparecem 2 pessoas no "Agendamento direto"
A lista mostra apenas quem já conectou uma agenda do Google ao sistema. Hoje só Guilherme e Priscila conectaram. Quem não conectou não pode ser dono da agenda, porque a Lia não consegue ler horários livres nem marcar reuniões nela.

## O que muda na tela do agente
Um bloco novo, "Quem participa do atendimento", com os dois campos empilhados:

1. **Responsável pelo atendimento humano**
   - Texto: "Recebe a conversa quando a Lia passa para uma pessoa e as tarefas de acompanhamento."
   - Lista: todos os membros ativos do workspace.
2. **Proprietário da agenda de vendas**
   - Texto: "A Lia consulta a agenda dessa pessoa e marca as reuniões nela, com link do Meet."
   - Lista: todos os membros ativos. Quem tem agenda conectada pode ser escolhido; quem não tem aparece desativado com a marca "Sem agenda conectada".
   - Aviso abaixo: "Só aparecem para escolha pessoas com agenda do Google conectada. Para incluir alguém, essa pessoa deve conectar a agenda em Configurações › Agenda."

Duração, fuso, expediente e demais regras de agendamento continuam onde estão, sob "Agendamento direto", logo abaixo do novo bloco.

## O que sai
- O campo "Anfitrião e agenda" na aba Habilidades e ferramentas vira o campo 2 acima (mesma informação, sem duplicar).
- O campo antigo "Página de agendamento" (sem efeito na Lia, que nunca envia link) deixa de aparecer. O valor guardado é preservado.

## O que não muda
- Nenhuma regra de quem recebe conversa ou de onde a reunião é marcada.
- Permissões: os mesmos acessos de hoje para editar o agente. Ninguém ganha acesso novo.
- Valores atuais: Eduarda continua responsável e Guilherme continua dono da agenda.

## Ajuda
Atualizar o artigo do Agente SDR explicando os dois papéis e por que a lista de agendas é limitada (bump de versão).

## Detalhes técnicos
- `sdr-agent-config.tsx`: "Responsável e agenda" vira "Quem participa do atendimento" com dois campos em coluna única; remove o select `booking_page_id` da UI (coluna preservada, já sem efeito no runtime conforme AGENTS.md).
- Campo 2 grava em `scheduling.host_user_id`/`calendar_account_id` do rascunho (`sdr_agent_versions.tool_config`) pelo mesmo caminho atual do `sdr-skills-panel.tsx`; passa a exigir publicação para valer, como hoje.
- `sdr-skills-panel.tsx`: remove o select de anfitrião e mostra o nome do proprietário com link para o bloco novo.
- `admin.server.ts`: incluir membros ativos sem agenda para exibir como desativados (só nome).
- Atualizar contrato em `permission-contracts.json` (apresentação), `help:coverage`, `permissions:check`, testes do SDR e conferência no Playwright.
