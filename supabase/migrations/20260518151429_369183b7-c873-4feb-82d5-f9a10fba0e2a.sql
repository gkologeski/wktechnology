
insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', true)
on conflict (id) do update set public = true;

create policy "wa media public read"
on storage.objects for select
using (bucket_id = 'whatsapp-media');

create policy "wa media auth insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'whatsapp-media');

create policy "wa media auth update"
on storage.objects for update to authenticated
using (bucket_id = 'whatsapp-media')
with check (bucket_id = 'whatsapp-media');

create policy "wa media service delete"
on storage.objects for delete to service_role
using (bucket_id = 'whatsapp-media');
