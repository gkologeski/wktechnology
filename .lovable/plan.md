# Agente principal (⭐)

## Objetivo
Permitir marcar um agente como **principal** do workspace. Ele aparece com ⭐ e vem pré-selecionado em todos os seletores de agente.

## O que muda para o usuário
- Em `/agents/sdr`, ao lado do seletor "Agente", novo botão **"Definir como principal"** (ícone de estrela). Se o agente escolhido já for o principal, o botão aparece preenchido e desativado com o texto "Agente principal".
- Na lista do seletor, o principal mostra ⭐ antes do nome e fica no topo.
- Ao abrir `/agents/sdr` (todas as abas, incluindo Habilidades e ferramentas), o agente principal vem escolhido. Isso resolve também a aba abrindo com o piloto.
- Em nova campanha de WhatsApp, o campo "Agente SDR" vem com o principal pré-selecionado (o usuário pode trocar ou escolher "Sem agente"). Na edição de campanha, o agente salvo continua valendo.
- Agente desativado não pode ser marcado como principal (botão desativado com explicação).

## Regras
- Reaproveita a configuração já existente do workspace (`sdr_workspace_settings.default_playbook_id`), que hoje já é a Lia. Nenhuma migration.
- Importante: esse mesmo campo já é o agente usado para conversas novas sem vínculo. Marcar outro agente como principal muda também esse padrão; o aviso aparece na confirmação.
- Só quem pode gerenciar agentes SDR altera (validação no servidor, workspace ativo, membership ativa; "Ver como" não grava). Demais usuários só veem a ⭐.
- Ação com confirmação.

## Detalhes técnicos
- `src/lib/sdr-agent.functions.ts`: `listPlaybooks` passa a retornar `defaultPlaybookId`; nova server fn `setDefaultPlaybook({ id })` com `requireSupabaseAuth`, checa playbook do workspace ativo e habilitado, faz upsert em `sdr_workspace_settings` com cliente do usuário (RLS), erro claro se negado.
- `src/components/prospecting/sdr-agent-picker.tsx`: fallback = principal → com questionário → primeiro; ⭐ no item; botão estrela com loading/aria-label; invalida `sdr-overview` e `sdr-playbooks`.
- `src/routes/_authenticated/agents.sdr.tsx`: repassar `defaultPlaybookId` ao picker e à aba de habilidades.
- `src/routes/_authenticated/campaigns.whatsapp.tsx`: em nova campanha, estado inicial do agente = principal; ⭐ no item.
- Helper puro de escolha do padrão + teste (principal preferido; ignora se desativado/inexistente).

## Validação
- Testes do helper; typecheck, lint, build.
- Playwright com sessão: marcar/ver ⭐, recarregar e conferir seleção padrão em `/agents/sdr` e nova campanha. Não publicar, não enviar mensagens.

---

# Título da reunião marcada pela Lia

## O que muda
- Reuniões marcadas pelo agente passam a ter o título **"Reunião [empresa] <> WK Technology"** (ex.: "Reunião Acme <> WK Technology"), na agenda e na atividade do CRM.
- Empresa vem do registro vinculado à conversa (Empresa do contato/lead/negócio). Sem empresa conhecida, usa o nome da pessoa; sem nenhum dos dois, "Reunião <> WK Technology" vira "Reunião com a WK Technology".
- Em Habilidades e ferramentas, o campo de título vira um modelo com `{empresa}` (padrão "Reunião {empresa} <> WK Technology"), editável por agente. Configurações salvas com o título antigo padrão são tratadas como o novo modelo.
- Vale para reuniões novas; as já criadas não mudam.

## Detalhes técnicos
- `catalog.ts`: novo padrão do `meeting_title` com `{empresa}`.
- Helper puro `meetingTitle(template, { company, person })` + testes (com empresa, sem empresa, título antigo).
- `dispatcher.ts` (linhas ~324 e ~374): usar o helper com a empresa resolvida do contexto CRM da conversa (somente do workspace ativo).
- `sdr-skills-panel.tsx`: padrão novo e dica do `{empresa}`.
- Atualizar rascunho da Lia para o novo modelo (sem publicar).
