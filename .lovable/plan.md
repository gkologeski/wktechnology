# ETAPA-ASSINA — Etapa selecionada evidente + documento de assinatura formatado

Porte: M. Estimativa: 2h30 a 3h30 (inclui nova assinatura do aditivo NEXID, testes, Ajuda e permissões).

## 1. Jornada do negócio: etapa atual x etapa selecionada (porte P, ~30 min)
Hoje a etapa selecionada só muda a cor do texto ("Minuta" azul), e o círculo fica igual aos outros.

- Etapa atual: círculo preenchido com a cor principal (como hoje).
- Etapa selecionada (quando não for a atual): círculo vazado, fundo do cartão, borda de 3px na cor principal e número na cor principal.
- Quando a selecionada for também a atual: círculo preenchido com um anel externo, para mostrar as duas coisas.
- Etapas concluídas mantêm o check.
- Botão recebe `aria-pressed` para leitores de tela; foco visível preservado.

## 2. Documento de assinatura com a formatação do modelo (porte M, ~2h)
Causa confirmada: ao "Preparar assinatura no TechERP", o banco copia o corpo do contrato removendo todas as marcações (títulos, negrito, parágrafos, listas). Por isso aparece "&amp;" e tudo vira um bloco só. A página do signatário (cliente e empresa usam a mesma) mostra texto puro.

- Nova migração substitui a preparação da assinatura: guarda o corpo do contrato com sua formatação, precedido de um cabeçalho com título, número, partes, vigência e valor em formato brasileiro (R$ 18.870,00 e datas 14/11/2026).
- A integridade (hash) continua sendo calculada sobre o conteúdo exato que o signatário vê; a trava contra edição do documento vinculado continua.
- Página de assinatura (`/sign/$token`) e tela de Assinatura eletrônica: quando o documento é formatado, mostram com o mesmo estilo de documento usado na revisão do contrato, sempre passando pelo filtro de segurança de HTML; documentos antigos em texto continuam aparecendo como hoje.
- Documentos já preparados não mudam (a assinatura deles vale para aquele conteúdo). O aditivo NEXID C-202611-5749 já está "enviado"; para o Gustavo receber a versão formatada, ofereço revogar a atual e preparar uma nova pela interface, só com sua confirmação.

## 3. Ajuda e permissões
- Atualizar artigo da Ajuda de assinatura do contrato (bump de versão) e o do negócio/jornada.
- Sem permissão nova: preparação segue em `techcontracts.signature_evidence.manage.workspace`; página do signatário segue por token. Registrar contratos de arquivo em `permission-contracts.json`.

## Detalhes técnicos
- `src/components/deals/deal-contracting-journey.tsx` (classes do círculo por `viewedStage`/`stage`, tokens semânticos).
- Nova migração `drizzle/migrations/03xx_*`: `CREATE OR REPLACE public.hiring_contract_native_prepare` trocando `regexp_replace(c.body_html,'<[^>]*>',' ','g')` por HTML do cabeçalho + `c.body_html`; marcar `body` com prefixo de formato (ex. comentário `<!--techerp:html-->`) para distinguir de texto antigo.
- `src/routes/sign.$token.tsx` + visualização em `/settings/esign`: renderizar com `sanitizeTemplateHtml` e classes `prose`, fallback `whitespace-pre-wrap`.
- Testes: detecção de formato + sanitização (script removido) e teste do banco existente `signature-delivery-postgres.test.ts` ajustado.
- Validação: Playwright na jornada (screenshot das duas etapas) e na página do signatário.
