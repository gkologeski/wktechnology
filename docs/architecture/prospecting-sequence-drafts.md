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

## Lote de versões de configuração

`0293_prospecting_sequence_versions.sql` cria snapshots imutáveis por revisão.
A ação usa `system.automation.sequences.manage` e exige também a leitura da linha;
permissão de editar um rascunho não concede a de criar versões. O banco copia o
conteúdo salvo, sem aceitar definição/dono/autor enviados pelo cliente. Repetir
a criação da mesma revisão devolve a mesma versão. Alteração concorrente exige
recarregar. Usuários não têm escrita direta; UPDATE é proibido inclusive por
gatilho. Não há status executável nem fila/evento de prospecção nesta migração.

A tela valida a configuração salva antes de solicitar uma versão. O preflight
revalida contas visíveis e habilitadas, Gmail conectado do próprio remetente,
responsáveis ativos, agentes com versão publicada e vínculos habilitados para
campanhas e atendimento nas contas utilizadas. O catálogo WhatsApp é consultado
no provedor para o número autorizado exato; falha não vira catálogo vazio e não
há fallback para a tabela local. Os parâmetros posicionais são conferidos.
Cada catálogo é consultado uma vez por conta em cada validação.

Limites explícitos deste lote: chamadas automáticas aguardam o executor; modelos
com mídia, cabeçalho variável, variáveis nomeadas ou botões parametrizados exigem
outro adaptador e impedem a validação atual. A seleção aceita modelos de corpo
de texto com até vinte variáveis posicionais. A etapa de chamada humana exige
responsável e será convertida em tarefa pelo futuro executor.

O preflight é uma verificação pontual de configuração, não prova permanente de
credenciais, elegibilidade dos destinatários ou disponibilidade dos provedores.
A RPC de snapshot aplica autorização e integridade, não consulta a Meta. Mesmo
uma versão obtida diretamente pela RPC nunca autoriza execução por si só.
Antes de inscrever ou enviar, os próximos lotes devem validar filtros,
consentimento/opt-out, provedores, referência de cada conta/agente/responsável e
permissões atuais. Um worker nunca pode confiar apenas na existência da versão.

## Lote de reserva do público

A migração 0294 registra inscrições imutáveis em estado reservado, sem criar
filas ou enviar mensagens. A ação exige leitura e atribuição da versão, com
escopo atual do usuário. Os filtros congelados são resolvidos pelo mesmo leitor
de público das campanhas WhatsApp; resultados truncados são recusados.

O banco revalida a identidade sob RLS e as máscaras atuais. Registra somente
resumos na interface e mantém a evidência de autorização e os hashes de
identidade inacessíveis aos clientes. Opt-out, ausência de canal, duplicidade,
clientes, negócios abertos e inscrições anteriores produzem motivos distintos.
As exclusões comerciais e de outra sequência seguem a configuração; opt-out e
validade do canal não são opcionais. A proteção cobre estas reservas, inscrições
legadas de sequências e inscrições SDR ativas. Não representa um catálogo de
todas as campanhas do sistema.

Repetições da mesma requisição são idempotentes. Uma trava transacional por
workspace impede reservas concorrentes duplicadas. Consultas por UUIDs usam
lotes de 150 para respeitar o limite de URL do gateway, inclusive nas campanhas
WhatsApp que compartilham o leitor.

Ainda faltam executor, cancelamento/liberação das reservas, ingresso dinâmico e
retomada individual. Antes de qualquer execução, o executor deve revalidar
permissões, consentimento, opt-out, canais, contas, agentes e disponibilidade dos
provedores. A existência de uma reserva não autoriza um envio.
