CREATE OR REPLACE FUNCTION public.manage_employee(p_user_id uuid, p_role text, p_active boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); caller text; old_role text;
begin
 caller:=private.user_role(actor);
 if actor is null or not (private.has_permission(actor,'employees.manage')
    or private.has_permission(actor,'employees.manage_sales')) then raise exception 'Forbidden'; end if;
 if not exists(select 1 from public.app_roles where slug=p_role and active) then raise exception 'Unknown or disabled role'; end if;
 select role into old_role from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Employee not found'; end if;
 if caller<>'superuser' and (p_role='superuser' or old_role='superuser') then raise exception 'Protected superuser'; end if;
 if caller<>'superuser' and p_user_id=actor then raise exception 'Cannot change your own role'; end if;
 if caller<>'superuser' and exists(
   select 1 from public.app_role_permissions granted
   where granted.role_slug=p_role and not private.has_permission(actor,granted.permission_key)
 ) then raise exception 'Cannot assign permissions you do not possess'; end if;
 if caller<>'superuser' and not private.has_permission(actor,'employees.manage')
   and (p_role<>'sales_manager' or old_role not in ('pending','sales_manager')) then raise exception 'Sales managers only'; end if;
 if old_role='superuser' and (p_role<>'superuser' or not p_active) then
  perform pg_advisory_xact_lock(719204, 1);
  if (select count(*) from public.profiles where role='superuser' and active)<=1 then raise exception 'Cannot remove last active superuser'; end if;
 end if;
 update public.profiles set role=p_role,active=p_active where id=p_user_id;
 insert into public.role_audit(actor_id,action,subject,detail)
 values(actor,'employee.permissions_changed',p_user_id::text,
 jsonb_build_object('previous_role',old_role,'new_role',p_role,'active',p_active));
end $function$
;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using(
 id=(select auth.uid()) or private.has_permission((select auth.uid()),'staff.view')
 or private.has_permission((select auth.uid()),'employees.manage')
 or private.has_permission((select auth.uid()),'employees.manage_sales')
);
