import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { HistoryTimelineItem } from "../../src/components/activity/history-timeline-item";
it("renders the production history card into a disposable browser benchmark", () => {
  const root = process.env.ISO_ROOT;
  if (!root?.endsWith("/.techerp-isolated.local")) throw Error("Isolated directory required");
  const cards = Array.from({ length: 1500 }, (_, i) =>
    renderToStaticMarkup(
      createElement(HistoryTimelineItem, {
        group: {
          id: `hist_${i}`,
          changed_at: "2026-10-10T12:00:00Z",
          changed_by: null,
          hasMovement: false,
          changes: Array.from({ length: 3 }, (_, j) => ({
            id: `${i}_${j}`,
            entity: "leads",
            entity_id: "fixture",
            property: "last_name",
            old_value: "Antes",
            new_value: `Teste ${i} ${j}`,
            changed_at: "2026-10-10T12:00:00Z",
            changed_by: null,
          })),
        },
        resolveValue: (_p, v) => String(v),
        resolveActor: () => `Fixture ${i}`,
      }),
    ),
  ).join("");
  expect(cards.match(/Fixture /g)?.length).toBe(1500);
  writeFileSync(
    root + "/app/public/__timeline-benchmark.html",
    `<!doctype html><meta charset="utf-8"><title>Benchmark isolado de timeline</title>
<style>body{font:14px system-ui}header{position:fixed;top:0;left:0;right:0;background:white;z-index:2;padding:12px;border-bottom:1px solid}main{margin-top:180px;width:720px}ol{list-style:none;padding:0}#cards>li{padding:18px;border:1px solid #ddd;border-radius:16px;margin-bottom:20px;min-height:160px;box-sizing:border-box}h4{margin:0}svg{width:14px;height:14px}ul li{display:flex;gap:8px}#cards.virtual>li{content-visibility:auto;contain-intrinsic-size:auto 160px}</style>
<header><h1>1500 cards reais · teste local</h1><button id="baseline">Medir sem otimização</button> <button id="optimized">Medir com otimização</button> <button id="anchor">Ver item 1000</button><pre id="result">Aguardando medição</pre></header><main><ol id="cards">${cards}</ol></main>
<script>
const cards=document.getElementById('cards'), result=document.getElementById('result');
async function run(mode){cards.classList.toggle('virtual',mode==='optimized');scrollTo(0,0);await new Promise(requestAnimationFrame);let times=[];
for(let i=0;i<25;i++){await new Promise(requestAnimationFrame);const start=performance.now();cards.style.width=(700+i%2)+'px';const height=cards.scrollHeight;times.push(performance.now()-start)}
times.sort((a,b)=>a-b);result.textContent=JSON.stringify({mode,cards:cards.children.length,p50_ms:times[12],p95_ms:times[23],supports:CSS.supports('content-visibility','auto')});}
document.getElementById('baseline').onclick=()=>run('baseline');document.getElementById('optimized').onclick=()=>run('optimized');document.getElementById('anchor').onclick=()=>cards.children[1000].scrollIntoView();
</script>`,
  );
});
