revoke execute on function public.asset_command(uuid,text,jsonb) from anon;
revoke execute on function public.manage_employee(uuid,text,boolean) from anon;
revoke execute on function public.task_transition(text,uuid,text,jsonb) from anon;
revoke execute on function public.handle_new_profile() from anon,authenticated,public;