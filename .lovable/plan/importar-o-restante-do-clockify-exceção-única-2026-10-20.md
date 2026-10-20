# Importar o restante do Clockify (exceção única)

## Situação
6.521 apontamentos estão retidos em revisão:
- 3.401 com horário sobreposto na própria origem
- 2.819 de pessoas sem vínculo no TechERP
- 265 com duração zero
- 36 trechos com menos de 1 segundo

## O que será feito
1. **Conferir antes de gravar**: recontar os 6.521 por motivo e por pessoa, e confirmar quais pessoas ainda estão sem vínculo.
2. **Pessoas sem vínculo**: criar identidade histórica inativa para cada uma (mesmo modelo das 191 já criadas: sem login, convite, e-mail ou papel). Se alguma não tiver e-mail, ela recebe um nome técnico baseado no ID do Clockify.
3. **Gravar os 6.521 apontamentos** com marca "importado com exceção" e o motivo original guardado, para poder filtrar ou desfazer depois:
   - sobrepostos: gravados mesmo sobrepondo outros horários;
   - duração zero e menos de 1 segundo: gravados com a duração real (0 ou frações de segundo), sem arredondar.
4. A exceção vale **só para esta execução** e só para esses registros; as regras normais continuam para tudo o resto, incluindo próximas importações e lançamentos manuais.
5. **Relatório final**: quantos entraram por motivo, total de horas antes e depois, e a conferência com o total do Clockify.

## Garantias
- Somente workspace WK. Nada alterado no Clockify.
- Nenhum aviso, e-mail, workflow, cobrança ou fatura; horas não faturáveis.
- Ninguém ganha acesso ou permissão.
- Desfazer possível: os registros com a marca de exceção podem ser removidos em lote.
- Nada publicado.

## Riscos que você aceita
- Horas sobrepostas podem somar mais horas por pessoa/dia do que o real (relatórios e margens podem ficar inflados para esses dias).
- Apontamentos de 0 segundos aparecerão nas listas.

## Detalhes técnicos
- Migração aditiva com função `clockify_import_force_pending(p_run uuid)` SECURITY DEFINER, execute só service_role: liga flag de sessão `app.clockify_force_import='on'` que os gatilhos de sobreposição/duração positiva respeitam apenas quando a origem é `clockify` e a flag está ativa; grava `metadata.clockify.forced_reason`; cria vínculo em `clockify_import_links`; reutiliza `app.clockify_import='on'` para suprimir workflow_events.
- Identidades históricas pela função existente em lote.
- Validação: contagens no banco antes/depois, workflow_events/notifications inalterados, teste SQL de que sem a flag o gatilho continua recusando; `bun run verify` e `bun run build`; Playwright na aba de revisão (deve ficar zerada).
