insert into public.api_keys (owner_id, workspace_id, name, prefix, key_hash, scopes)
select k.owner_id, k.workspace_id, v.name, v.prefix, v.hash, v.scopes
from (select owner_id, workspace_id from public.api_keys where name='site' limit 1) k,
(values ('qa-api-v1-rw','lvb_583a2c9','43247822b02b5f68c66ff6f90967d9e5b3ff44255ad317023d046ef0c209bcca', array['read','write']),
        ('qa-api-v1-ro','lvb_ccb1896','0edc76a4c4e3486b2118729029d041c64a799fdf33aace14e33579ca13f62273', array['read'])) as v(name,prefix,hash,scopes);