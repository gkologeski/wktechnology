# PROXIMO-PASSO-CONTRATO — Ficha do contrato guiada por etapas

**Porte:** M · **Estimativa:** 4–6 h no total (Fase 1: 1h30–2h · Fase 2: 2h30–4h)
Pela regra do projeto, redesign relevante exige mockup aprovado: a Fase 2 só começa depois da sua aprovação da Fase 1.

## Problema (confirmado no código da ficha `/contracts/$id`)
- O topo mostra só botões soltos: Fluxo do contrato, Medições, Visualizar, Salvar, Excluir. Nenhum diz "o que fazer agora".
- A situação muda por um campo "Status" dentro de "Dados principais"; "Em revisão" e "Aguardando assinatura" aparecem bloqueados sem explicação.
- Aprovações, Assinatura, Aditivos, Serviços, Projetos, Proposta, Histórico e Corpo ficam empilhados em ~12 cartões sem ordem de jornada.
- O corpo do contrato é um campo de texto simples com aviso de "próxima sprint".

## O que muda para o usuário
1. **Barra de etapas no topo**: Rascunho → Revisão/Aprovação → Assinatura → Ativo → Renovação/Encerramento, destacando a etapa atual.
2. **Cartão "Próximo passo"** com uma única ação principal por situação, e o motivo quando estiver bloqueada:
   - Rascunho: "Enviar para aprovação" (ou "Preparar para assinatura" se não houver aprovadores configurados); antes, lista o que falta (vigência, valor, signatário, corpo).
   - Em revisão: "Ver aprovações pendentes" com quem precisa aprovar.
   - Aguardando assinatura: "Acompanhar assinatura" / reenviar.
   - Assinado e não ativo: "Ativar contrato e serviços" (só com a permissão de ativação).
   - Ativo: "Adicionar aditivo", "Registrar medição"; perto do fim, "Renovar".
3. **Ações secundárias** num menu "Mais ações" (Fluxo, Medições, Visualizar arquivo, Duplicar, Excluir com confirmação).
4. **Abas** organizando o conteúdo: Visão geral (dados + vigência + serviços), Documento (corpo + arquivo), Aprovações e assinatura, Aditivos e vínculos, Histórico.
5. Campo "Status" deixa de ser o caminho principal; mudanças de situação passam pelas ações guiadas (o campo continua disponível para quem tem permissão, sem remover nada).

## Fase 1 — Mockup para aprovação
- Protótipo em rota separada (`/contracts/prototype`) com dados demonstrativos, mostrando a ficha em 4 situações (rascunho, em revisão, aguardando assinatura, ativo), em claro/escuro e celular.
- Sem leitura/gravação real. Você aprova ou pede ajustes.

## Fase 2 — Aplicar na ficha real (após aprovação)
- Reorganizar `/contracts/$id` com os componentes oficiais (PageHeader, SectionHeader, StatusBadge, EmptyState, skeleton e erro).
- Regra única "qual é o próximo passo" num módulo puro testado, usando os dados que a tela já carrega (status, aprovações, assinatura, vigência).
- Cada ação reaproveita os fluxos e permissões já existentes (aprovação, assinatura, ativação, aditivo); botões ficam desabilitados com dica quando faltar permissão. Sem mudança de banco, RLS ou regra de negócio.
- Ajuda: novo artigo/atualização "Ficha do contrato e próximos passos" com versão nova.

## Detalhes técnicos
- Novo `src/lib/contracts/contract-next-step.ts` (função pura status+contexto → ação/bloqueios) + testes por situação e por falta de permissão.
- Componentes novos em `src/components/contracts/detail/` (StageStepper, NextStepCard, MoreActionsMenu); rota continua exportando só `Route`.
- Protótipo em `src/components/contracts/prototype/` + rota-filha com `Outlet` no pai quando necessário.
- Registro em `permission-contracts.json` (classificação apresentação para o protótipo; ações reutilizam chaves existentes), `permissions:check`, testes, typecheck, build e Playwright nas 4 situações.

## Fora do escopo
- Editor rico do corpo do contrato, mudanças na listagem `/contracts`, novas integrações de assinatura.
