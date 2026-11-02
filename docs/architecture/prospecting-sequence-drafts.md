# Sequências multicanal — lote de rascunhos

A aprovação visual do protótipo em 02/11/2026 libera a integração incremental.
Este lote implementa `/prospecting/sequences`: planejamento de etapas, público
com o `AudienceGroupsEditor` do WhatsApp e persistência de rascunhos. Não
inscreve destinatários, não ativa agentes e não realiza envios ou chamadas.

## Fronteiras

- As chaves existentes `system.automation.sequences.view/create/update` mantêm
  escopos own/team/workspace. Não são concedidas permissões a cargos.
- Menu, rota, UI e server functions usam a matriz. As RPCs conferem novamente
  o workspace ativo, membership, deny, dono e operação real (create/update).
- `prospecting_sequence_drafts` só admite SELECT direto para usuários; escrita
  somente pela RPC. Revisões ficam em tabela separada, sem UPDATE/DELETE direto.
- `expectedRevision` e trava transacional impedem sobrescrita concorrente.
- A prévia consulta CRM com o cliente do usuário e RLS. Mostra contagens antes
  das exclusões planejadas, uma amostra de oito nomes e aviso de truncamento.
  Ela não representa autorização comercial de contato.
- Referências de contas/agentes conservam a permissão independente de canais.
  Nenhum segredo de provedor é carregado pelo construtor.
- Cadências anteriores não são migradas nem alteradas. A antiga ação de
  registrar atividade de e-mail não se transforma em envio real.

## Aplicação e aceite

A migration nova é `0292_prospecting_sequence_drafts.sql`. Não reaplicar o
histórico. Aplicar em produção apenas com CI e aceite concluídos, antes de
publicar a tela. O script `scripts/isolated-db/sequence-drafts-acceptance.mjs`
exige o marcador da stack local descartável e usa JWT emitido pelo GoTrue.
Restaura os overrides e apaga somente fixtures próprias em `finally`.

Os testes locais Vitest ficam em `src/lib/prospecting/sequences/`. Verificação
global, build finalizado e checagem de performance são exigidos no fechamento.
A aprovação do protótipo não é evidência de implantação em produção.

## Próximos lotes

1. Publicação de versões imutáveis, preflight por canal e seleção de templates
   aprovados com variáveis reais. Revalidar todas as referências no workspace.
2. Inscrição/snapshot, exclusões, deduplicação, opt-out e autorização de contato.
3. Executor com fila, lease/CAS, idempotência e reconciliação de envios incertos;
   e-mail real, WhatsApp oficial e telefonia existente, sem atalhos legados.
4. Eventos de resposta/reunião/atendimento humano cancelam contatos pendentes;
   associação inequívoca de conversa e canal; agente definido por atendimento.
5. Resultados, motivos de pausa/falha, métricas de entrega e aceite por canal.

A definição de rascunho é entrada de planejamento: não deve ser consumida por
workers como instrução executável antes da validação e publicação de versão.
