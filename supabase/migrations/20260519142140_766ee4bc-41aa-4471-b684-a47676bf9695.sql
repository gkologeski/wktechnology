
alter function public.enqueue_workflow_event() security invoker;
revoke execute on function public.enqueue_workflow_event() from public, anon, authenticated;
