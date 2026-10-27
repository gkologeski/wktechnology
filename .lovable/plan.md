# Destacar número, status e qualidade em /settings/whatsapp

Porte P — estimativa 20–30 min. Só apresentação: sem mudar dados, permissões, envio ou servidor.

## O que muda
1. **Conexões diretas (Meta)** — cada número hoje aparece numa linha de texto pequeno. Passa a ser um bloco por número com:
   - número em destaque (fonte maior, negrito) e nome verificado abaixo;
   - selo de status (Disponível / Indisponível / status da Meta);
   - selo de qualidade colorido: Alta (verde), Média (amarelo), Baixa (vermelho), Não avaliada (neutro).
   - No cabeçalho da conexão, o "Ativa / Em preparação" vira selo em vez de texto.
2. **Número do conector atual** — a qualidade sai da grade de campos e vira selo ao lado do selo "Conectado", junto do número já em destaque.

## Detalhes técnicos
- Arquivos: `src/components/whatsapp/cloud-connections-panel.tsx` e `src/routes/_authenticated/settings.whatsapp.tsx`.
- Novo helper puro `src/lib/whatsapp/quality-display.ts` (rótulo + variante de status para GREEN/YELLOW/RED/UNKNOWN), reutilizado nas duas telas, com teste unitário dos 4 valores.
- Usa `StatusBadge` e tokens semânticos existentes; sem cores avulsas; dark mode e acessibilidade (texto no selo, não só cor).
- Contrato de permissão: classificação "apenas apresentação".
- Validação: teste do helper, verify:changed, build e Playwright autenticado em /settings/whatsapp (sem testar/sincronizar conexões).
