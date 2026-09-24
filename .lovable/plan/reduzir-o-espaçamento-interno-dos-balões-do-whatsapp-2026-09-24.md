# Reduzir o espaçamento interno dos balões do WhatsApp

## Objetivo
Deixar os balões da conversa na timeline mais compactos e fiéis ao WhatsApp, reduzindo significativamente o espaço acima e abaixo do texto sem prejudicar a leitura.

## Implementação
1. Ajustar somente os estilos dos balões WhatsApp:
   - reduzir o espaçamento vertical interno do conteúdo;
   - manter um espaçamento horizontal curto e confortável;
   - compactar a altura da linha;
   - preservar horário e confirmação de leitura na mesma linha sempre que houver espaço.
2. Neutralizar margens herdadas da formatação rica dentro dos balões, evitando altura adicional em textos simples ou com múltiplas linhas.
3. Manter inalterados o fundo, as cores, o alinhamento, a identificação dos participantes e as conversas antigas.
4. Conferir visualmente mensagens curtas e longas em tela ampla e estreita.

## Detalhes técnicos
- O excesso está concentrado no conteúdo da célula do balão, atualmente com espaçamento vertical e altura de linha próprios, dentro de uma área `.prose`.
- A alteração será restrita às regras `.whatsapp-bubble-content` e aos elementos textuais internos dos balões em `src/styles.css`.
- Serão executados os testes do conversor WhatsApp, verificação de tipos e lint dos arquivos afetados.

## Limites
- Nenhuma mudança em dados, permissões, integrações ou regras de identificação de remetente.
- Nenhuma alteração visual fora das conversas WhatsApp da timeline.
