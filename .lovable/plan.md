## Causas

1. **Itens não aparecem** — o `<tr>` do template `Prosposta 001` não está dentro de `{{#each items}}…{{/each}}`, então os campos por linha (`{{name}}`, `{{quantity}}`, `{{unit_price}}`, `{{discount_pct}}`, `{{tax_rate}}`, `{{line_total}}`) são resolvidos no contexto raiz — onde não existem — e a linha sai vazia (só sobra `%` fixo em Desc./Imp., idêntico ao print).
2. **Acentuação quebrada** — o HTML salvo em `quote_templates.html` contém sequências mojibake (`CotaÃ§Ã£o`, `VÃ¡lida`, `DestinatÃ¡rio`, `ReferÃªncia`, `ResponsÃ¡vel`, `NÂº`, `DescriÃ§Ã£o`, `PreÃ§o`, `TÃ©cnica`, etc.) — bytes UTF‑8 interpretados como Latin‑1 e regravados. É por isso que o print mostra "COTAÃŠCO Nº", "VÁLIDA ATÉ", "REFERÊNCIA" bagunçados. O `<meta charset="utf-8">` está correto; o dano está no conteúdo.

Nenhum dos dois problemas está no código do renderer — os dois são no HTML do template `01a2c7aa-f235-4cd9-8b86-f3e7d380ebf8` ("Prosposta 001").

## Correção (única migration `UPDATE` em `quote_templates`)

1. Envolver a linha da tabela de itens com `{{#each items}}…{{/each}}`:

   ```text
   <tbody>
     {{#each items}}
     <tr>
       <td>
         <div class="it-name">{{name}}</div>
         <div class="it-desc">{{description}}</div>
       </td>
       <td class="r">{{quantity}}</td>
       <td class="r">{{unit_price}}</td>
       <td class="r">{{discount_pct}}%</td>
       <td class="r">{{tax_rate}}%</td>
       <td class="r"><strong>{{line_total}}</strong></td>
     </tr>
     {{/each}}
   </tbody>
   ```

   Removo `<div class="it-pill">{{category}}</div>` porque `category` não existe no contexto de itens do renderer (`items` traz apenas `name/description/quantity/unit_price/discount_pct/tax_rate/line_total`) — hoje já sai vazio. Se quiser um selo, me diga qual campo (SKU, unidade, etc.).

2. Recodificar todos os textos afetados para UTF‑8 correto, incluindo (não limitado a):

   | Antes (mojibake) | Depois |
   |---|---|
   | `CotaÃ§Ã£o NÂº` | `Cotação Nº` |
   | `VÃ¡lida atÃ©` | `Válida até` |
   | `DestinatÃ¡rio` | `Destinatário` |
   | `ResponsÃ¡vel` | `Responsável` |
   | `ReferÃªncia` | `Referência` |
   | `NÂº` | `Nº` |
   | `Item / DescriÃ§Ã£o` | `Item / Descrição` |
   | `PreÃ§o Unit.` | `Preço Unit.` |
   | `ObservaÃ§Ãµes` | `Observações` |
   | `Termos e CondiÃ§Ãµes` | `Termos e Condições` |
   | `AssinaÃ§Ã£o Digital` (se houver) | `Assinatura Digital` |

   Aplico via `convert_from(convert_to(html,'LATIN1'),'UTF8')` restrito a esse `id`, o que reverte o mojibake de forma determinística e preserva CSS/JS/marcações válidas. Depois faço `UPDATE` do trecho da tabela para inserir o `{{#each items}}`.

3. Nenhum outro modelo é tocado. Nenhum código-fonte é alterado. O renderer (`src/lib/quote-template-renderer.ts`) continua igual.

## Validação

- Reabrir `https://crm.wktechnology.com.br/quote/5a09e4174e33e1e38856abb5da083ef4cd604604525ca335` e conferir:
  - a linha da tabela lista o item real (`Consultoria Técnica … Vibe Code / Lovable`);
  - cabeçalhos e cards mostram acentuação correta ("Cotação Nº", "Válida até", "Destinatário", "Responsável", "Referência", "Item / Descrição", "Preço Unit.", "Observações", "Termos e Condições");
  - totais permanecem iguais (Subtotal / Descontos / Impostos / Total Geral).

## Fora de escopo

- Não altero outros templates. Se houver outros com o mesmo defeito, posso auditar em seguida.
- Não mexo em RLS, no wizard, no editor visual (`quote-template-blocks.ts`) nem no renderer.