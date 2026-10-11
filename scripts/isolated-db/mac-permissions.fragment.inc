// Configuration tables must no longer silently fall into the original tenant.
const configId = '74000000-0000-4000-8000-' + randomBytes(6).toString('hex');
try {
  await check('config-default-user-b','integrity','Real B session creates configuration in B when a legacy client omits workspace_id',async()=>{
    const r=await s[6].from('api_keys').insert({id:configId,owner_id:U(6),name:'[ISO] Config B',prefix:'iso-test',key_hash:configId,scopes:['read']}).select('workspace_id').single();
    if(r.error) throw r.error;
    return r.data.workspace_id;
  },WB);
  await check('integration-default-user-b','integrity','Real B session creates an inert integration in B without a legacy fixed default',async()=>{
    const r=await s[6].from('email_accounts').insert({id:configId,owner_id:U(6),provider:'gmail',email:'isolated-'+configId+'@techerp-test.invalid',status:'connected'}).select('workspace_id').single();
    if(r.error) throw r.error;
    return r.data.workspace_id;
  },WB);
  await check('sales-view-default-user-b','integrity','Legacy browser creates a saved sales view in B instead of the original company',async()=>{
    const r=await s[6].from('saved_views').insert({id:configId,owner_id:U(6),entity:'leads',name:'[ISO] Sales B',is_shared:false,is_default:false,filters:{},quick_filters:[]}).select('workspace_id').single();
    if(r.error) throw r.error;
    return r.data.workspace_id;
  },WB);
  await check('config-default-job-refused','integrity','Service job without an explicit source fails instead of using the original tenant',async()=>{
    return psql(`BEGIN; SET LOCAL ROLE service_role;
      DO $$ BEGIN
        BEGIN
          INSERT INTO public.api_keys(id,owner_id,name,prefix,key_hash,scopes) VALUES ('${configId.replace('74000000','74100000')}','${U(6)}','[ISO] Job','iso-job','${configId}-job',ARRAY['read']);
          RAISE EXCEPTION 'Job accepted without a source workspace';
        EXCEPTION WHEN not_null_violation THEN NULL; END;
      END $$;
      SELECT 'refused'; ROLLBACK;`);
  },'refused');
  await check('config-fixed-defaults-removed','integrity','All forty-nine audited source tables derive their default from the authenticated session',async()=>psql(`SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='public' AND a.attname='workspace_id' AND c.relname IN ('api_keys','booking_pages','email_broadcasts','custom_reports','goals','push_subscriptions','recurring_plans','report_schedules','scoring_rules','segments','sequences','whatsapp_campaigns','workflows','ai_summaries','bookings','calendar_events','email_tracking_events','webhook_deliveries','calendar_accounts','email_accounts','quotes','quote_line_items','dashboard_widgets','record_layouts','saved_views','sequence_enrollments','email_threads','email_messages','email_unsubscribes','email_broadcast_recipients','subscriptions','message_sentiments','integrations','hubspot_sync_state','workflow_events','leads','companies','contacts','deals','pipelines','esign_audit','score_events','scoring_cursors','tickets','whatsapp_messages','deal_line_items','activities','enrichment_jobs','credit_ledger') AND pg_get_expr(d.adbin,d.adrelid) LIKE '%default_workspace_for_user%';`),'49');
} finally { psql(`DELETE FROM public.saved_views WHERE id='${configId}'; DELETE FROM public.email_accounts WHERE id='${configId}'; DELETE FROM public.api_keys WHERE id='${configId}'`); }

await check('scoring-cursor-workspace-pair','integrity','One owner retains independent scoring cursors in A and B',async()=>psql(`BEGIN;
DELETE FROM public.scoring_cursors WHERE owner_id='${U(2)}';
INSERT INTO public.scoring_cursors(workspace_id,owner_id,last_event_at) VALUES ('${WA}','${U(2)}','2026-01-01'),('${WB}','${U(2)}','2026-02-01');
SELECT count(*) FROM public.scoring_cursors WHERE owner_id='${U(2)}';
ROLLBACK;`),'2');

await check('workspace-fixed-defaults-zero','integrity','No public workspace_id column has a literal UUID default',async()=>psql(`SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='public' AND a.attname='workspace_id' AND pg_get_expr(d.adbin,d.adrelid) ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';`),'0');

await check('workspace-default-active-member','integrity','Active membership resolves the selected company',async()=>psql(`SELECT public.default_workspace_for_user('${U(2)}')::text;`),WA);
await check('workspace-default-inactive-refused','integrity','Inactive membership cannot select a company through a legacy default',async()=>psql(`SELECT coalesce(public.default_workspace_for_user('${U(5)}')::text,'refused');`),'refused');
await check('workspace-default-invalid-selection-refused','integrity','An inaccessible selected company never silently falls back to another',async()=>psql(`BEGIN; UPDATE public.profiles SET active_workspace_id='${WB}' WHERE id='${U(2)}'; SELECT coalesce(public.default_workspace_for_user('${U(2)}')::text,'refused'); ROLLBACK;`),'refused');

// Regression of restricted roles through real GoTrue sessions and PostgREST.
const roleId = '30000000-0000-4000-8000-0000000000a1';
const permSuffix = randomBytes(6).toString('hex');
const fixtureId = (n: number) => `7100000${n}-0000-4000-8000-${permSuffix}`;
const ownDeal = '51000000-0000-4000-8000-0000000000a1';
const peerDeal = '51000000-0000-4000-8000-0000000000a7';
const previousRestricted = psql(`select restricted_visibility::text from public.job_roles where id='${roleId}'`);
try {
  psql(`
    UPDATE public.job_roles SET restricted_visibility=true WHERE id='${roleId}';
    INSERT INTO public.whatsapp_conversations(id,workspace_id,owner_id,assigned_to,contact_phone,twilio_number) VALUES
      ('${fixtureId(1)}','${WA}','${U(7)}','${U(7)}','+5500000010001','+5500000010099');
    INSERT INTO public.whatsapp_messages(id,workspace_id,owner_id,conversation_id,direction,from_number,to_number,body) VALUES
      ('${fixtureId(2)}','${WA}','${U(7)}','${fixtureId(1)}','inbound','+5500000010001','+5500000010099','[ISO] Restricted peer message');
    INSERT INTO public.calendar_events(id,workspace_id,owner_id,provider_event_id,title) VALUES
      ('${fixtureId(3)}','${WA}','${U(7)}','iso-peer-${permSuffix}','[ISO] peer calendar'),
      ('${fixtureId(4)}','${WA}','${U(2)}','iso-own-${permSuffix}','[ISO] own calendar');
    INSERT INTO public.property_history(id,workspace_id,owner_id,entity,entity_id,property) VALUES
      ('${fixtureId(5)}','${WA}','${U(7)}','deals','${peerDeal}','name'),
      ('${fixtureId(6)}','${WA}','${U(2)}','deals','${ownDeal}','name');
    INSERT INTO public.email_threads(id,workspace_id,owner_id,account_id,provider_thread_id,deal_id,subject) VALUES
      ('${fixtureId(7)}','${WA}','${U(2)}','54000000-0000-4000-8000-0000000000a2','iso-peer-${permSuffix}','${peerDeal}','[ISO] Restricted thread');
    UPDATE public.email_threads SET owner_id='${U(7)}' WHERE id='${fixtureId(7)}';
    INSERT INTO public.email_messages(id,workspace_id,owner_id,account_id,thread_id,provider_message_id,direction,subject,body_text) VALUES
      ('${fixtureId(0)}','${WA}','${U(2)}','54000000-0000-4000-8000-0000000000a2','${fixtureId(7)}','iso-hidden-${permSuffix}','inbound','[ISO] Hidden child','synthetic');
    INSERT INTO public.stage_entries(id,workspace_id,owner_id,entity,entity_id,stage_id) VALUES
      ('${fixtureId(8)}','${WA}','${U(7)}','deals','${peerDeal}','won'),
      ('${fixtureId(9)}','${WA}','${U(2)}','deals','${ownDeal}','won');
  `);
  async function ids(client: SupabaseClient, table: string, wanted: string[]) {
    const r = await client.from(table).select('id').in('id',wanted);
    if(r.error) throw r.error;
    return r.data.map((x: {id:string})=>x.id).sort().join(',');
  }
  for(const [table, hidden, visible] of [
    ['whatsapp_conversations',fixtureId(1),'57000000-0000-4000-8000-0000000000a2'],
    ['whatsapp_messages',fixtureId(2),'58000000-0000-4000-8000-0000000000a2'],
    ['calendar_events',fixtureId(3),fixtureId(4)],
    ['property_history',fixtureId(5),fixtureId(6)],
    ['stage_entries',fixtureId(8),fixtureId(9)],
  ]) {
    await check(`restricted-${table}`, 'permissions', 'Own row visible, peer row hidden through the real user session', ()=>ids(s[2],table,[hidden,visible]),visible);
    await check(`unrestricted-${table}`, 'permissions', 'Workspace role retains both rows (positive control)', ()=>ids(s[4],table,[hidden,visible]),[hidden,visible].sort().join(','));
    await check(`tenant-b-${table}`, 'permissions', 'Other tenant sees neither row', ()=>ids(s[6],table,[hidden,visible]),'');
  }
  await check('restricted-email-threads','permissions','Mailbox access does not override restricted portfolio',()=>ids(s[2],'email_threads',[fixtureId(7)]),'');
  await check('restricted-email-messages','permissions','Message owned by the user stays hidden when the parent thread is hidden',()=>ids(s[2],'email_messages',[fixtureId(0),'56000000-0000-4000-8000-0000000000a2']),'56000000-0000-4000-8000-0000000000a2');
  await check('tenant-b-email-messages','permissions','Another tenant cannot read the hidden message',()=>ids(s[6],'email_messages',[fixtureId(0)]),'');
  await check('restricted-inbox-search','permissions','Unified inbox search does not expose the hidden peer conversation',async()=>{
    const r=await s[2].rpc('get_inbox_unified_page',{p_search:'+5500000010001'});
    if(r.error) throw r.error;
    return JSON.stringify(r.data).includes(fixtureId(1))?'leaked':'hidden';
  },'hidden');
} finally {
  psql(`DELETE FROM public.whatsapp_messages WHERE id='${fixtureId(2)}';
    DELETE FROM public.whatsapp_conversations WHERE id='${fixtureId(1)}';
    DELETE FROM public.calendar_events WHERE id IN ('${fixtureId(3)}','${fixtureId(4)}');
    DELETE FROM public.property_history WHERE id IN ('${fixtureId(5)}','${fixtureId(6)}');
    DELETE FROM public.email_messages WHERE id='${fixtureId(0)}';
    DELETE FROM public.email_threads WHERE id='${fixtureId(7)}';
    DELETE FROM public.stage_entries WHERE id IN ('${fixtureId(8)}','${fixtureId(9)}');
    UPDATE public.job_roles SET restricted_visibility=${previousRestricted==='true'?'true':'false'} WHERE id='${roleId}';`);
}
