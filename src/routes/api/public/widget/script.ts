// Public route: serves the widget.js loader.
import { createFileRoute } from "@tanstack/react-router";

const SCRIPT = `(function(){
  var s = document.currentScript;
  var ws = s && s.getAttribute('data-workspace');
  if (!ws) { console.warn('[chat-widget] missing data-workspace'); return; }
  var origin = new URL(s.src).origin;
  function clamp(v,min,max,def){ var n=parseInt(v,10); return isNaN(n)?def:Math.min(max,Math.max(min,n)); }
  var color = s.getAttribute('data-color') || '';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = '#3b82f6';
  var side = s.getAttribute('data-position') === 'left' ? 'left' : 'right';
  var w = clamp(s.getAttribute('data-width'), 300, 480, 360);
  var h = clamp(s.getAttribute('data-height'), 400, 720, 520);
  var btn = document.createElement('button');
  btn.setAttribute('aria-label', 'Abrir chat');
  btn.style.cssText='position:fixed;bottom:20px;'+side+':20px;width:56px;height:56px;border-radius:50%;background:'+color+';color:#fff;border:0;box-shadow:0 6px 16px rgba(0,0,0,.18);cursor:pointer;font-size:24px;z-index:2147483646;';
  btn.textContent='💬';
  var frame = document.createElement('iframe');
  frame.src = origin + '/widget/' + encodeURIComponent(ws);
  frame.style.cssText='position:fixed;bottom:90px;'+side+':20px;width:'+w+'px;height:'+h+'px;max-width:calc(100vw - 40px);max-height:calc(100vh - 110px);border:0;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.22);z-index:2147483647;display:none;background:#fff;';
  frame.setAttribute('title','Chat ao vivo');
  document.body.appendChild(btn);
  document.body.appendChild(frame);
  btn.addEventListener('click', function(){
    frame.style.display = (frame.style.display === 'none') ? 'block' : 'none';
  });
})();`;

export const Route = createFileRoute("/api/public/widget/script")({
  server: {
    handlers: {
      GET: async () =>
        new Response(SCRIPT, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        }),
    },
  },
});
