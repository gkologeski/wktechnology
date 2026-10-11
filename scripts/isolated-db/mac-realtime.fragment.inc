// Inserted by mac-prepare-tests.mjs into the existing authenticated SDK suite.
// No filters by workspace: the absence of B events at A must be enforced by RLS.
const rtA: any[] = [], rtB: any[] = [];
const suffix = randomBytes(6).toString('hex');
const eventA = '62000000-0000-4000-8000-' + suffix;
const eventB = '63000000-0000-4000-8000-' + suffix;
const channelErrors: string[] = [];
const diagnostics: any = { startedAt: new Date().toISOString(), states: [], events: [], reads: [], lateProbe: {} };
function recordEvent(channel: string, payload: any) {
  diagnostics.events.push({ at: new Date().toISOString(), channel, type: payload.eventType,
    id: payload.new?.id ?? payload.old?.id, workspace: payload.new?.workspace_id,
    owner: payload.new?.owner_id, errors: payload.errors });
}
async function readProbe() {
  for (const [tenant, client] of [['A',s[2]],['B',s[6]]] as const) {
    const {data,error} = await client.from('activities').select('id,workspace_id,owner_id').in('id',[eventA,eventB]);
    diagnostics.reads.push({tenant,data,error:error?.message ?? null});
  }
}

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean, ms = 15000) {
  const start = Date.now();
  while (!predicate() && Date.now() - start < ms) await pause(100);
  if (!predicate()) throw new Error('Evento esperado não recebido dentro do prazo');
}
async function subscribe(client: SupabaseClient, name: string, events: any[]) {
  await client.realtime.setAuth((await client.auth.getSession()).data.session!.access_token);
  const channel = client.channel(name).on('postgres_changes',
    { event: '*', schema: 'public', table: 'activities' }, payload => { events.push(payload); recordEvent(name, payload); });
  await new Promise<void>((resolve, reject) => {
    let joined=false, postgresReady=false;
    const timer = setTimeout(() => reject(new Error('Timeout waiting for channel AND PostgreSQL subscription')), 20000);
    const ready=()=>{if(joined && postgresReady){clearTimeout(timer);resolve();}};
    channel.on('system' as any, {}, (payload:any)=>{
      diagnostics.states.push({at:new Date().toISOString(),name,status:'SYSTEM',...payload});
      if(payload.extension==='postgres_changes') {
        if(payload.status==='ok'){postgresReady=true;ready();}
        if(payload.status==='error'){clearTimeout(timer);reject(new Error(payload.message??'Postgres subscription refused'));}
      }
    });
    channel.subscribe((status, error) => {
      diagnostics.states.push({at:new Date().toISOString(),name,status,error:error?.message ?? null});
      if (status === 'SUBSCRIBED') { joined=true;ready(); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        channelErrors.push(status); clearTimeout(timer);
        reject(new Error(error?.message ?? status));
      }
    });
  });
  return channel;
}

try {
  await check('rt-subscribe-own', 'realtime', 'Confirmação real do servidor para A e B', async () => {
    await subscribe(s[2], 'iso-a-' + suffix, rtA);
    await subscribe(s[6], 'iso-b-' + suffix, rtB);
    return 'subscribed';
  }, 'subscribed');
  await check('rt-insert-delivery', 'realtime', 'Cada sessão recebe uma inserção autorizada', async () => {
    psql(`INSERT INTO public.activities(id,workspace_id,owner_id,type,subject) VALUES
      ('${eventA}','${WA}','${U(2)}','note','[ISO] Realtime A'),
      ('${eventB}','${WB}','${U(6)}','note','[ISO] Realtime B')`);
    await readProbe();
    await until(() => rtA.some(e => e.eventType === 'INSERT' && e.new.id === eventA)
      && rtB.some(e => e.eventType === 'INSERT' && e.new.id === eventB));
    return 'received';
  }, 'received');
  await check('rt-filter-other-tenant', 'realtime', 'RLS impede eventos cruzados, com controles positivos nos dois lados', async () => {
    await pause(2500);
    const positive = rtA.some(e => e.new?.id === eventA) && rtB.some(e => e.new?.id === eventB);
    const leaked = rtA.some(e => e.new?.id === eventB) || rtB.some(e => e.new?.id === eventA);
    return positive && !leaked && channelErrors.length === 0 ? 'isolated' : 'failed';
  }, 'isolated');
  await check('rt-update-delivery', 'realtime', 'Atualização chega à sessão autorizada', async () => {
    psql(`UPDATE public.activities SET subject='[ISO] Realtime atualizado' WHERE id='${eventA}'`);
    await until(() => rtA.some(e => e.eventType === 'UPDATE' && e.new.id === eventA && e.new.subject === '[ISO] Realtime atualizado'));
    return 'received';
  }, 'received');
  // Diagnostic only: a late INSERT cannot turn the original missing INSERT into a pass.
  if (results.some(r => r.id === 'rt-insert-delivery' && r.status === 'fail')) {
    const lateA = '64000000-0000-4000-8000-' + suffix;
    const lateB = '65000000-0000-4000-8000-' + suffix;
    try {
      psql(`INSERT INTO public.activities(id,workspace_id,owner_id,type,subject) VALUES
        ('${lateA}','${WA}','${U(2)}','note','[ISO] Late probe A'),
        ('${lateB}','${WB}','${U(6)}','note','[ISO] Late probe B')`);
      try { await until(() => rtA.some(e => e.new?.id === lateA) && rtB.some(e => e.new?.id === lateB)); }
      catch (error) { diagnostics.lateProbe.error = (error as Error).message; }
      diagnostics.lateProbe.aReceived = rtA.some(e => e.new?.id === lateA);
      diagnostics.lateProbe.bReceived = rtB.some(e => e.new?.id === lateB);
      diagnostics.lateProbe.crossTenant = rtA.some(e => e.new?.id === lateB) || rtB.some(e => e.new?.id === lateA);
    } finally { psql(`DELETE FROM public.activities WHERE id IN ('${lateA}','${lateB}')`); }
  }
  await check('rt-auto-reconnect', 'realtime', 'SDK recovers after abrupt transport loss without manual reconnect', async () => {
    const {default: WebSocket} = await import(root + '/app/node_modules/ws/wrapper.mjs');
    const sockets: any[] = [];
    class FaultSocket extends WebSocket {
      constructor(url: string, protocols?: any, options?: any) { super(url, protocols, options); sockets.push(this); }
    }
    const client = createClient(URL_, anonKey, {auth:{persistSession:false,autoRefreshToken:false},realtime:{transport:FaultSocket as any}});
    try {
      const login = await client.auth.signInWithPassword({email:EMAIL[2],password:PW});
      if(login.error) throw login.error;
      const events: any[] = [];
      const name = 'iso-auto-' + suffix;
      await subscribe(client,name,events);
      sockets.at(-1).terminate();
      await until(()=>diagnostics.states.filter((x:any)=>x.name===name && x.status==='SUBSCRIBED').length>=2,45000);
      psql(`UPDATE public.activities SET subject='[ISO] Realtime auto' WHERE id='${eventA}'`);
      await until(()=>events.some(e=>e.eventType==='UPDATE' && e.new.id===eventA && e.new.subject==='[ISO] Realtime auto'));
      return 'received';
    } finally { await client.removeAllChannels(); await client.auth.signOut(); }
  }, 'received');
  await check('rt-delete-sdk', 'realtime', 'DELETE arrives as a tombstone containing the already known row id', async () => {
    psql(`DELETE FROM public.activities WHERE id='${eventB}'`);
    await until(()=>rtB.some(e=>e.eventType==='DELETE' && e.old.id===eventB));
    return 'received';
  }, 'received');
  // Every subscription waits for both the socket join and Postgres authorization.
  async function tableChannel(client: SupabaseClient, table: string, filter: string, events: any[]) {
    await client.realtime.setAuth((await client.auth.getSession()).data.session!.access_token);
    const c = client.channel('iso-matrix-' + table + '-' + randomBytes(4).toString('hex'));
    c.on('postgres_changes', {event:'*',schema:'public',table,filter}, p=>events.push(p));
    await new Promise<void>((resolve,reject)=>{
      let joined=false, ready=false;
      const timer=setTimeout(()=>reject(new Error('Table readiness timeout: '+table)),20000);
      const done=()=>{if(joined&&ready){clearTimeout(timer);resolve();}};
      c.on('system' as any,{},(p:any)=>{
        if(p.extension!=='postgres_changes')return;
        if(p.status==='ok'){ready=true;done();}
        if(p.status==='error'){clearTimeout(timer);reject(new Error(p.message));}
      });
      c.subscribe(status=>{if(status==='SUBSCRIBED'){joined=true;done();}});
    });
    return c;
  }
  for(const [table,column,id,field] of [
    ['workspace_branding','workspace_id',WA,'primary_color'],
    ['module_branding','workspace_id',WA,'product_name'],
    ['email_threads','id','55000000-0000-4000-8000-0000000000a2','subject'],
    ['whatsapp_messages','conversation_id','57000000-0000-4000-8000-0000000000a2','body'],
    ['chat_messages','conversation_id','59000000-0000-4000-8000-0000000000a1','body'],
    ['property_history','entity_id','50000000-0000-4000-8000-0000000000a1','property'],
  ]) {
    await check('rt-matrix-'+table,'realtime','Real filtered SDK delivery for '+table,async()=>{
      const events:any[]=[];
      const c=await tableChannel(s[2],table,column+'=eq.'+id,events);
      const token=table==='workspace_branding'?'#334455':'[ISO] matrix '+suffix;
      try {
        psql(`UPDATE public.${table} SET ${field}='${token}' WHERE ${column}='${id}'`);
        await until(()=>events.some(e=>e.eventType==='UPDATE'&&e.new[field]===token));
        if(events.some(e=>e.new[column]!==id))throw new Error('Filtered channel received foreign row');
        return 'received';
      } finally {await s[2].removeChannel(c);}
    },'received');
  }
  for (const table of ['deal_line_items', 'meetings', 'calendar_events']) {
    await check('rt-cycle14-'+table, 'realtime', 'INSERT/UPDATE and opaque DELETE reconciliation with tenant isolation for '+table, async()=> {
      const a='81000000-0000-4000-8000-'+randomBytes(6).toString('hex');
      const b='82000000-0000-4000-8000-'+randomBytes(6).toString('hex');
      const events:any[]=[];
      const c=await tableChannel(s[1],table,'workspace_id=eq.'+WA,events);
      const deletions:any[]=[];
      const dc=await tableChannel(s[2],'workspace_realtime_signals','workspace_id=eq.'+WA,deletions);
      const insert=(id:string,ws:string,owner:string,deal:string)=> {
        if(table==='deal_line_items') return `INSERT INTO public.deal_line_items(id,workspace_id,owner_id,deal_id,name) VALUES ('${id}','${ws}','${owner}','${deal}','[ISO] realtime item')`;
        if(table==='meetings') return `INSERT INTO public.meetings(id,workspace_id,owner_id,assigned_to,title,room_name,public_token) VALUES ('${id}','${ws}','${ws}','${owner}','[ISO] realtime meeting','iso-${id}','iso-${id}')`;
        return `INSERT INTO public.calendar_events(id,workspace_id,owner_id,provider_event_id,title) VALUES ('${id}','${ws}','${owner}','iso-${id}','[ISO] realtime calendar')`;
      };
      try {
        psql(insert(a,WA,U(1),'51000000-0000-4000-8000-0000000000a1')+';'+insert(b,WB,U(6),'51000000-0000-4000-8000-0000000000b1'));
        await until(()=>events.some(e=>e.eventType==='INSERT'&&e.new?.id===a));
        const col=table==='deal_line_items'?'name':'title';
        psql(`UPDATE public.${table} SET ${col}='[ISO] updated cycle14' WHERE id IN ('${a}','${b}')`);
        await until(()=>events.some(e=>e.eventType==='UPDATE'&&e.new?.id===a&&e.new?.[col]==='[ISO] updated cycle14'));
        await pause(500);
        const read=await s[1].from(table).select('id').eq('id',b);
        if(read.error||read.data?.length||events.some(e=>e.new?.id===b))throw new Error('Other tenant leaked');
        psql(`DELETE FROM public.${table} WHERE id IN ('${a}','${b}')`);
        await until(()=>deletions.some(e=>e.new?.workspace_id===WA&&e.new?.table_name===table));
        const signal=deletions.find(e=>e.new?.table_name===table).new;
        if(Object.keys(signal).some(key=>!['workspace_id','table_name','nonce','updated_at'].includes(key)))throw new Error('Deletion signal exposes record metadata');
        const foreign=await s[2].from('workspace_realtime_signals').select('workspace_id').eq('workspace_id',WB);
        if(foreign.error||foreign.data?.length||deletions.some(e=>e.new?.workspace_id===WB))throw new Error('Deletion signal crossed tenant');
        return 'delivered-isolated';
      } finally { await s[1].removeChannel(c);await s[2].removeChannel(dc);psql(`DELETE FROM public.${table} WHERE id IN ('${a}','${b}')`); }
    },'delivered-isolated');
  }
  await check('rt-delete-activity-signal','realtime','Opaque scoped signal reconciles activity DELETE without sending private IDs',async()=>{
    const id='83000000-0000-4000-8000-'+randomBytes(6).toString('hex');
    const events:any[]=[];
    const c=await tableChannel(s[2],'workspace_realtime_signals','workspace_id=eq.'+WA,events);
    try {
      psql(`INSERT INTO public.activities(id,workspace_id,owner_id,related_lead_id,type,subject) VALUES ('${id}','${WA}','${U(2)}','50000000-0000-4000-8000-0000000000a1','note','[ISO] opaque deletion'); DELETE FROM public.activities WHERE id='${id}'`);
      await until(()=>events.some(e=>e.new?.table_name==='activities'&&e.new?.workspace_id===WA));
      return 'received';
    } finally { await s[2].removeChannel(c);psql(`DELETE FROM public.activities WHERE id='${id}'`); }
  },'received');
  await check('rt-signal-user-cannot-forge','permissions','Members cannot insert or change deletion signals',async()=>{
    const insert=await s[2].from('workspace_realtime_signals').insert({workspace_id:WA,table_name:'activities'});
    const update=await s[2].from('workspace_realtime_signals').update({nonce:'00000000-0000-4000-8000-000000000001'}).eq('workspace_id',WA);
    return insert.error?.code==='42501'&&update.error?.code==='42501'?'blocked':'FAILED';
  },'blocked');
  await check('rt-burst-coalesced','realtime','Twenty real updates reach the SDK and use the application batcher',async()=>{
    const {createInvalidationBatcher}=await import(root+'/../src/lib/realtime/invalidation-batcher.ts');
    const events:any[]=[];
    const c=await tableChannel(s[2],'activities','id=eq.'+eventA,events);
    let flushes=0, received=0;
    const batcher=createInvalidationBatcher(()=>flushes++);
    const listener=setInterval(()=>{while(events.length) {const e=events.shift();if(e.new?.subject?.startsWith('[ISO] burst ')){received++;batcher.push([['activities',eventA]]);}}},10);
    try {
      psql(Array.from({length:20},(_,i)=>`UPDATE public.activities SET subject='[ISO] burst ${i}' WHERE id='${eventA}';`).join('\n'));
      await pause(1800);
      if(received!==20||flushes<1||flushes>3)throw new Error('Burst was not grouped: '+flushes);
      return 'grouped';
    } finally {clearInterval(listener);batcher.cancel();await s[2].removeChannel(c);}
  },'grouped');
  await check('rt-context-switch','realtime','Replacing real GoTrue identity removes old subscription and receives only B context',async()=>{
    const client=createClient(URL_,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const events:any[]=[];
    try {
      const a=await client.auth.signInWithPassword({email:EMAIL[2],password:PW});if(a.error)throw a.error;
      const old=await tableChannel(client,'activities','id=eq.'+eventA,events);
      await client.removeChannel(old);events.length=0;
      const b=await client.auth.signInWithPassword({email:EMAIL[6],password:PW});if(b.error)throw b.error;
      const fresh='74000000-0000-4000-8000-'+suffix;
      await tableChannel(client,'activities','workspace_id=eq.'+WB,events);
      try {
        psql(`INSERT INTO public.activities(id,workspace_id,owner_id,type,subject) VALUES ('${fresh}','${WB}','${U(6)}','note','[ISO] switched B'); UPDATE public.activities SET subject='[ISO] switched A' WHERE id='${eventA}';`);
        await until(()=>events.some(e=>e.new?.id===fresh));await pause(1000);
        if(events.some(e=>e.new?.id===eventA))throw new Error('Old context event leaked');
        return 'switched';
      }finally{psql(`DELETE FROM public.activities WHERE id='${fresh}'`);}
    }finally{await client.removeAllChannels();await client.auth.signOut();}
  },'switched');
  await check('rt-membership-revoked','realtime','Active subscription stops receiving protected updates after membership removal',async()=>{
    const events:any[]=[], control:any[]=[];
    const c=await tableChannel(s[2],'activities','id=eq.'+eventA,events);
    const admin=await tableChannel(s[1],'activities','id=eq.'+eventA,control);
    try {
      psql(`UPDATE public.workspace_members SET status='inactive' WHERE user_id='${U(2)}' AND workspace_id='${WA}'`);
      await pause(5000);
      const token='[ISO] revoked '+suffix;
      psql(`UPDATE public.activities SET subject='${token}' WHERE id='${eventA}'`);
      await until(()=>control.some(e=>e.new?.subject===token));
      await pause(2500);
      const read=await s[2].from('activities').select('id').eq('id',eventA);
      if(read.error||read.data?.length||events.some(e=>e.new?.subject===token))throw new Error('Revoked session still has access');
      return 'denied';
    } finally {
      psql(`UPDATE public.workspace_members SET status='active' WHERE user_id='${U(2)}' AND workspace_id='${WA}'`);
      await s[2].removeChannel(c);await s[1].removeChannel(admin);
    }
  },'denied');
  await check('rt-manual-reconnect', 'realtime', 'Nova conexão e assinatura voltam a receber alterações', async () => {
    await s[2].removeAllChannels();
    s[2].realtime.disconnect();
    const next: any[] = [];
    await subscribe(s[2], 'iso-reconnected-' + suffix, next);
    psql(`UPDATE public.activities SET subject='[ISO] Realtime reconectado' WHERE id='${eventA}'`);
    await until(() => next.some(e => e.eventType === 'UPDATE' && e.new.id === eventA && e.new.subject === '[ISO] Realtime reconectado'));
    return 'received';
  }, 'received');
} finally {
  try {
    diagnostics.subscriptions = JSON.parse(psql(`SELECT coalesce(json_agg(x),'[]'::json) FROM
      (SELECT entity::regclass::text AS entity, claims->>'sub' AS user_id, count(*) AS subscriptions
       FROM realtime.subscription WHERE entity='public.activities'::regclass GROUP BY 1,2) x`));
  } catch (error) { diagnostics.subscriptionInspectionError = (error as Error).message; }
  diagnostics.finishedAt = new Date().toISOString();
  mkdirSync(root + '/artifacts', {recursive:true});
  writeFileSync(root + '/artifacts/realtime-diagnostics.json', JSON.stringify(diagnostics,null,2));
  await s[2].removeAllChannels();
  await s[6].removeAllChannels();
  psql(`DELETE FROM public.activities WHERE id IN ('${eventA}','${eventB}')`);
}
