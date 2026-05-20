import { createFileRoute } from "@tanstack/react-router";
import { getRequestHost } from "@tanstack/react-start/server";

const SCRIPT = (origin: string) => `(function(){
  var ORIGIN=${JSON.stringify(origin)};
  var STORAGE_PREFIX='lv_form_seen_';

  function h(tag, attrs, children){
    var el=document.createElement(tag);
    if(attrs) for(var k in attrs){
      if(k==='style'){el.setAttribute('style',attrs[k]);}
      else if(k.indexOf('on')===0){el.addEventListener(k.slice(2),attrs[k]);}
      else el.setAttribute(k,attrs[k]);
    }
    (children||[]).forEach(function(c){ el.appendChild(typeof c==='string'?document.createTextNode(c):c); });
    return el;
  }

  function buildForm(form, onDone){
    var box=h('form',{style:'display:flex;flex-direction:column;gap:12px;font-family:system-ui,-apple-system,sans-serif;width:100%;'});
    if(form.popup_config && form.popup_config.title){
      box.appendChild(h('div',{style:'font-size:20px;font-weight:600;'},[form.popup_config.title]));
    } else {
      box.appendChild(h('div',{style:'font-size:18px;font-weight:600;'},[form.name]));
    }
    if(form.popup_config && form.popup_config.description){
      box.appendChild(h('div',{style:'font-size:14px;color:#555;'},[form.popup_config.description]));
    }
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
            msg.textContent=''; box.innerHTML='';
            box.appendChild(h('div',{style:'padding:16px;background:#ecfdf5;color:#065f46;border-radius:6px;'},[res.j.message||'Enviado!']));
            if(onDone) setTimeout(onDone, 2500);
          } else { msg.style.color='#b91c1c'; msg.textContent=res.j.error||'Erro ao enviar'; }
        })
        .catch(function(){ btn.disabled=false; msg.style.color='#b91c1c'; msg.textContent='Erro de rede'; });
    });
    return box;
  }

  function renderInline(target, form){
    target.innerHTML='';
    target.appendChild(buildForm(form));
  }

  function seenKey(slug){ return STORAGE_PREFIX+slug; }
  function shouldShow(slug, freqDays){
    try{
      var raw=localStorage.getItem(seenKey(slug));
      if(!raw) return true;
      if(!freqDays || freqDays<=0) return false;
      var ts=parseInt(raw,10); if(!ts) return true;
      return (Date.now()-ts)/(1000*60*60*24) >= freqDays;
    }catch(e){ return true; }
  }
  function markSeen(slug){ try{ localStorage.setItem(seenKey(slug), String(Date.now())); }catch(e){} }

  function openPopup(form){
    if(document.querySelector('[data-lovable-form-popup="'+form.slug+'"]')) return;
    var cfg=form.popup_config||{};
    var position=cfg.position||'center';
    var mode=form.display_mode;
    var overlay;
    var panelStyle='background:#fff;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,.25);padding:24px;max-width:480px;width:calc(100% - 32px);max-height:90vh;overflow:auto;position:relative;';
    if(mode==='slidein'){
      var posCss=position==='bottom-left'?'left:16px;':'right:16px;';
      overlay=h('div',{'data-lovable-form-popup':form.slug,style:'position:fixed;bottom:16px;'+posCss+'z-index:2147483000;'});
      var panel=h('div',null);
      panel.setAttribute('style',panelStyle+'width:380px;max-width:calc(100vw - 32px);');
      overlay.appendChild(panel);
    } else {
      var justify=position==='bottom-right'?'flex-end':(position==='bottom-left'?'flex-start':'center');
      var align=position==='center'?'center':'flex-end';
      overlay=h('div',{'data-lovable-form-popup':form.slug,style:'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483000;display:flex;align-items:'+align+';justify-content:'+justify+';padding:24px;'});
      var panel=h('div',null); panel.setAttribute('style',panelStyle);
      overlay.appendChild(panel);
    }
    var inner=overlay.firstChild;
    var close=h('button',{type:'button',style:'position:absolute;top:8px;right:10px;background:transparent;border:0;font-size:22px;line-height:1;cursor:pointer;color:#666;'},['×']);
    function dismiss(){
      markSeen(form.slug);
      if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    close.addEventListener('click',dismiss);
    if(mode!=='slidein'){
      overlay.addEventListener('click',function(e){ if(e.target===overlay) dismiss(); });
    }
    inner.appendChild(close);
    inner.appendChild(buildForm(form, dismiss));
    document.body.appendChild(overlay);
  }

  function attachTriggers(form){
    var cfg=form.popup_config||{};
    var trigger=cfg.trigger||'time';
    var freq=typeof cfg.frequency_days==='number'?cfg.frequency_days:7;
    if(!shouldShow(form.slug, freq)) return;
    var fired=false;
    function fire(){ if(fired) return; fired=true; openPopup(form); }

    if(trigger==='load'){
      fire();
    } else if(trigger==='time'){
      var delay=(typeof cfg.delay_seconds==='number'?cfg.delay_seconds:5)*1000;
      setTimeout(fire, delay);
    } else if(trigger==='scroll'){
      var pct=typeof cfg.scroll_percent==='number'?cfg.scroll_percent:50;
      function onScroll(){
        var h=document.documentElement;
        var scrolled=(h.scrollTop+window.innerHeight)/h.scrollHeight*100;
        if(scrolled>=pct){ window.removeEventListener('scroll',onScroll); fire(); }
      }
      window.addEventListener('scroll',onScroll,{passive:true});
    } else if(trigger==='exit_intent'){
      function onLeave(e){
        if(e.clientY<=0 || (e.relatedTarget==null && e.toElement==null)){
          document.removeEventListener('mouseout',onLeave); fire();
        }
      }
      document.addEventListener('mouseout',onLeave);
      // mobile fallback: trigger on history back attempt or after long inactivity
      setTimeout(fire, 60000);
    }
  }

  function mount(el){
    var slug=el.getAttribute('data-lovable-form');
    if(!slug) return;
    fetch(ORIGIN+'/api/public/forms/'+slug).then(function(r){return r.json();}).then(function(form){
      if(!form || !form.fields) return;
      var mode=form.display_mode||'inline';
      if(mode==='inline'){ renderInline(el, form); }
      else { attachTriggers(form); }
    });
  }

  function mountSlug(slug){
    fetch(ORIGIN+'/api/public/forms/'+slug).then(function(r){return r.json();}).then(function(form){
      if(!form || !form.fields) return;
      var mode=form.display_mode||'inline';
      if(mode!=='inline') attachTriggers(form);
    });
  }

  function init(){
    document.querySelectorAll('[data-lovable-form]').forEach(mount);
    // popup mode via script tag: <script data-lovable-form-popup="slug" src="..."></script>
    var scripts=document.querySelectorAll('script[data-lovable-form-popup]');
    scripts.forEach(function(s){
      var slug=s.getAttribute('data-lovable-form-popup');
      if(slug) mountSlug(slug);
    });
  }
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
