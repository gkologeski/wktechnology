# Lia: oferta certa, sem link indevido e intenção do agente

## Causa (confirmada no banco e no código)
- **Link junto da oferta:** os materiais aprovados da WK são as páginas do site (Hunting, Outsourcing, Squad, Fábrica, Consultoria, IA). O sistema coloca no fim da mensagem todo material que a IA escolhe, mesmo quando ela só está *perguntando* se pode enviar. Foi o caso de "Quer que eu envie um material?" + link do Hunting.
- **Hunting como prioridade:** o catálogo tem Hunting (contratar CLT/PJ próprio) e Outsourcing (profissional alocado pela WK). O pedido "preciso de um desenvolvedor React Sênior" serve para os dois, e nenhuma regra manda perguntar antes de escolher.

## O que muda
1. **Materiais só quando fizer sentido**
   - O link só vai junto quando a intenção da resposta for "enviar material" **e** o cliente tiver pedido ou aceitado, em mensagem anterior. Oferecer ou perguntar não anexa nada.
   - Nova opção por agente: **"Anexar páginas do site"** (ligada ou desligada). Na Lia, ela começa **desligada**, como você pediu: as páginas do site não vão mais em nenhuma resposta.
2. **Escolha da oferta para "preciso de um profissional"**
   - Nova regra: quando o pedido puder ser Hunting ou Outsourcing (ou Squad, se for mais de uma pessoa), a Lia pergunta primeiro se o cliente quer contratar direto ou ter o profissional alocado e gerido pela WK. Só depois indica a oferta. Nenhuma oferta tem prioridade fixa.
3. **Intenção do agente: Prospecção ou Atendimento**
   - Novo campo em `/agents/sdr` › Persona e teste, guardado na versão do agente (rascunho e publicada, como o resto da persona).
   - **Prospecção:** mais ativa e persuasiva. Mostra benefícios ligados à dor relatada, contorna objeções com educação e procura levar a uma reunião, sem pressionar nem inventar promessas.
   - **Atendimento:** só informa e tira dúvidas. Oferece reunião apenas se o cliente pedir.
   - As regras fixas continuam valendo nos dois modos: sem preço, opt-out, passagem para humano e catálogo oficial.
   - A versão atual da Lia fica como **Prospecção**. A mudança passa a valer quando você publicar o rascunho.
4. **Teste:** o painel de teste usa a mesma intenção. Assim dá para comparar os dois modos sem enviar nada.

## Fora do escopo
Nenhuma mudança de permissão, de outros workspaces ou de campanhas. Nada será publicado ou enviado.

## Validação
- Testes automáticos: link não anexado ao só oferecer, anexado só com pedido e opção ligada; Lia sem páginas do site; regra Hunting/Outsourcing presente no texto do agente; diferença entre Prospecção e Atendimento.
- Verificação completa e versão de produção, com os resultados reais.
- Navegador: trocar a intenção, salvar o rascunho e testar "preciso de um desenvolvedor React Sênior" no painel de teste, sem publicar.

## Detalhes técnicos
- `actions.server.ts` › `composeOutgoing`: anexar materiais só com `intent === "send_material"` e `attach_site_pages` ligada. O worker também passa a recusar `material_ids` em outras intenções, com um aviso no registro.
- `agent-config.ts`: novo `attach_materials: boolean` (padrão `true`) em `sdr_playbooks`, por migration aditiva com default. Para a Lia, o valor será `false`.
- `persona.ts` › `PersonaSchema`: novo `intent: "prospecting" | "service"` (padrão `prospecting`), versionado em `sdr_agent_versions`. `buildSystemPrompt` ganha uma seção por intenção e a regra de desambiguação entre Hunting, Outsourcing e Squad.
- `sdr-agent-studio.tsx`: novo controle (Select) e o aviso "Anexar páginas do site" na configuração do agente.
