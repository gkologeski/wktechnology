import { createFileRoute } from "@tanstack/react-router";
import { getRequestHost } from "@tanstack/react-start/server";

const SCRIPT = (origin: string) => `(function(){
  var ORIGIN=${JSON.stringify(origin)};
  function h(tag, attrs, children){
    var el=document.createElement(tag);
    if(attrs) for(var k in attrs){ if(k==='style'){el.setAttribute('style',attrs[k]);} else if(k.indexOf('on')===0){el.addEventListener(k.slice(2),attrs[k]);} else el.setAttribute(k,attrs[k]); }
    (children||[]).forEach(function(c){ el.appendChild(typeof c==='string'?document.createTextNode(c):c); });
    return el;
  }
  function render(target, form){
    target.innerHTML='';
    var box=h('form',{style:'display:flex;flex-direction:column;gap:12px;font-family:system-ui,-apple-system,sans-serif;max-width:520px;'});
    box.appendChild(h('div',{style:'font-size:18px;font-weight:600;'},[form.name]));
    form.fields.forEach(function(f){
      var wrap=h('label',{style:'display:flex;flex-direction:column;gap:4px;font-size:13px;color:#444;'});
      wrap.appendChild(h('span',null,[f.label+(f.required?' *':'')]));
      var input;
      if(f.type==='textarea'){
        input=h('textarea',{name:f.key,rows:'4',placeholder:f.placeholder||'',style:'padding:8px;border:1px solid #d4d4d8;border-radius:6px;font:inherit;'});
      } else if(f.type==='select'){
        input=h('select',{name:f.key,style:'padding:8px;border:1px solid #d4d4d8;border-radius:6px;font:inherit;'});
        input.appendChild(h('option',{value:''},['Selecione...']));
        (f.options||[]).forEach(function(o){ input.appendChild(h('option',{value:o},[o])); });
      } else {
        input=h('input',{type:f.type||'text',name:f.key,placeholder:f.placeholder||'',style:'padding:8px;border:1px solid #d4d4d8;border-radius:6px;font:inherit;'});
      }
      if(f.required) input.required=true;
      wrap.appendChild(input);
      box.appendChild(wrap);
    });
    // honeypot
    var hp=h('input',{type:'text',name:'_hp',tabindex:'-1',autocomplete:'off',style:'position:absolute;left:-9999px;'});
    box.appendChild(hp);
    var btn=h('button',{type:'submit',style:'padding:10px 16px;background:#111;color:#fff;border:0;border-radius:6px;cursor:pointer;font:inherit;'},['Enviar']);
    box.appendChild(btn);
    var msg=h('div',{style:'font-size:13px;'});
    box.appendChild(msg);
    box.addEventListener('submit',function(e){
      e.preventDefault();
      btn.disabled=true; msg.textContent='Enviando...'; msg.style.color='#666';
      var fd=new FormData(box); var payload={}; fd.forEach(function(v,k){payload[k]=v;});
      fetch(ORIGIN+'/api/public/forms/'+form.slug+'/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
        .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
        .then(function(res){
          btn.disabled=false;
          if(res.ok){
            if(res.j.redirect_url){ window.location.href=res.j.redirect_url; return; }
            target.innerHTML=''; target.appendChild(h('div',{style:'padding:16px;background:#ecfdf5;color:#065f46;border-radius:6px;font-family:system-ui;'},[res.j.message||'Enviado!']));
          } else { msg.style.color='#b91c1c'; msg.textContent=res.j.error||'Erro ao enviar'; }
        })
        .catch(function(){ btn.disabled=false; msg.style.color='#b91c1c'; msg.textContent='Erro de rede'; });
    });
    target.appendChild(box);
  }
  function mount(el){
    var slug=el.getAttribute('data-lovable-form');
    if(!slug) return;
    fetch(ORIGIN+'/api/public/forms/'+slug).then(function(r){return r.json();}).then(function(form){
      if(form && form.fields) render(el, form);
    });
  }
  function init(){ document.querySelectorAll('[data-lovable-form]').forEach(mount); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();`;

export const Route = createFileRoute("/api/public/forms/embed-js")({
  server: {
    handlers: {
      GET: async () => {
        const host = getRequestHost();
        const origin = `https://${host}`;
        return new Response(SCRIPT(origin), {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
