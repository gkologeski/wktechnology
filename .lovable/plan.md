# Eduarda na lista de responsáveis + envio de materiais da Lia

## Diagnóstico (lido no banco e no código)

**1. Eduarda não aparece**
- Há duas Eduardas na WK: **Eduarda Astran** (ativa) e **Eduarda Morais** (inativa — corretamente fora).
- A lista "Sem dono / Eu / ..." da Inbox WhatsApp vem de uma tabela antiga de equipe (`team_members`), não dos membros reais do workspace. Eduarda Astran é membro ativo, mas não está nessa tabela antiga — por isso some.
- A gravação do responsável já valida pelos membros reais, então só a lista está errada.

**2. Material não enviado ao Eduardo Porto**
- Na Lia existem dois controles diferentes:
  - Habilidade "Materiais" (ligada) — permite a Lia oferecer/buscar materiais.
  - Chave "Anexar links de materiais (páginas do site) quando o cliente pedir" em Regras — está **desligada** (foi desligada quando pedimos para não mandar o link de hunting junto).
- Com a segunda desligada, o sistema retira o anexo e a Lia responde "envio de materiais indisponível". Ou seja, a ligação que você viu é a habilidade, não o anexo.

## O que será feito

1. **Lista de responsáveis da Inbox WhatsApp**: passar a listar todos os membros **ativos** do workspace atual (inativos continuam fora), em ordem alfabética, com "Eu" no topo. Eduarda Astran passa a aparecer.
2. **Configuração da Lia mais clara** em /agents/sdr:
   - Ao lado da habilidade Materiais, mostrar aviso quando o anexo estiver desligado: "Materiais ligados, mas o envio de links está desligado — a Lia só oferecerá".
   - Renomear a chave para "Enviar links de materiais ao cliente quando ele pedir" e colocá-la junto da habilidade Materiais.
3. **Não vou ligar o envio sozinho**: ligar o anexo volta a permitir links do site (inclusive o de hunting, que você pediu para não ir). Depois da mudança, você liga a chave e publica a Lia, ou me autoriza a fazer isso.
4. Encaminhamento do Eduardo Porto (pediu material no e-mail eduardo@epsystem.com.br): opcionalmente criar uma tarefa para um humano enviar — só com seu aceite.

## Validação
- Teste para a lista: membro ativo aparece, inativo não, outro workspace não.
- Playwright: Eduarda Astran no seletor; aviso visível na config da Lia.
- typecheck, lint, testes e build com resultados reais. Sem publicar e sem envios.

## Detalhes técnicos
- `src/lib/whatsapp.functions.ts` `listAssignableMembers`: trocar `team_members` por `workspace_members` (`workspace_id` ativo, `status = 'active'`) + `profiles`, via cliente do usuário (RLS).
- `src/components/prospecting/sdr-agent-config.tsx`: aviso quando `allowed_tools` contém `material` e `guardrails.attach_materials = false`; mover/renomear o switch `cfg-attachmat`.
- Estado atual: `sdr_playbooks.guardrails.attach_materials = false`, `material_ids = []` (usa todos os 6 materiais do workspace).
