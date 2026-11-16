# STATUS-CHAMADA — cores distintas em "Chamadas recentes"

Porte: P · Estimativa: 30–45 min

## Causa
A tela marca como vermelho toda chamada que tem "motivo de término". Como toda chamada concluída tem um motivo (ex.: cliente desligou), "completed" e "failed" ficam iguais.

## O que muda
- Status em português, com ícone e cor próprios (reaproveitando os tons já usados nas assinaturas):
  - Concluída — verde, visto
  - Falhou / Não conectou — vermelho, alerta
  - Não atendeu (customer-did-not-answer, caixa postal) — âmbar
  - Em andamento / Chamando — azul
- Motivo de término traduzido (ex.: "Cliente desligou", "Assistente encerrou", "Falha ao conectar").
- Nada muda em dados, permissões ou regras.

## Técnico
- Nova função pura `callStatusTone(status, ended_reason)` em `src/lib/prospecting/calls/recent-calls.ts` + rótulos do motivo; testes (completed com ended_reason = sucesso; failed = erro; did-not-answer = aviso).
- `campaigns.calls.$id.tsx` usa `SignatureStatusIndicator`/tokens semânticos no lugar do Badge destrutivo.
- Atualizar hash em permission-contracts.json e Ajuda da campanha (versão +1).
- Validar com Playwright na campanha Call ICP.
