# MODELOS-LIVRES — Sem limite de modelos na campanha de WhatsApp

Porte P — estimativa 30 a 45 minutos.

## O que muda para o usuário
- Em "Rodízio de modelos" você pode adicionar quantos modelos aprovados quiser (hoje o limite é 1 principal + 4 extras).
- O botão/lista "Adicionar modelo ao rodízio" continua aparecendo enquanto houver modelo aprovado ainda não escolhido.
- O limite de números (até 5) não muda.
- Tudo o mais continua igual: cada contato recebe sempre o mesmo modelo, cada modelo sai só pelos números em que está aprovado, conferência na Meta ao salvar, permissões e disparo.

## Detalhes técnicos
- `src/lib/whatsapp/campaign-template-rotation.ts`: trocar `MAX_ROTATION_TEMPLATES = 5` por um teto técnico alto só de proteção (100), sem aparecer na tela.
- `src/lib/whatsapp-campaigns.functions.ts`: `template_rotation .max(5)` (criar e editar) passa a usar a mesma constante.
- `src/routes/_authenticated/campaigns.whatsapp.tsx`: remover as travas `extraSelected.length >= 4` / `< 4` da lista de modelos e trocar o texto "Adicione até 4 modelos aprovados" por "Adicione os modelos aprovados que quiser".
- Teste: atualizar o teste de limite em `campaign-template-rotation` para aceitar mais de 5 modelos (ex.: 8 preservados).
- Ajuda: `docs/help/crm/criar-campanha-whatsapp.md` remove "até 4 modelos extras" e "até 5 modelos", bump de versão; aplicar pelo "Atualizar Ajuda oficial" e conferir só esse artigo.
- Validação: testes de WhatsApp, typecheck, `help:coverage`, e Playwright adicionando mais de 5 modelos na edição da campanha (sem salvar envio real).
- Sem migração, sem mudança de permissão, sem publicar.
