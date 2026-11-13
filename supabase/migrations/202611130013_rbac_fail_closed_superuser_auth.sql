CREATE OR REPLACE FUNCTION public.manage_role(p_action text, p_slug text, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_permissions text[] DEFAULT ARRAY[]::text[], p_active boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); old_role public.app_roles%rowtype;
begin
 if actor is null or coalesce(private.user_role(actor),'pending')<>'superuser' then raise exception 'Only superuser can manage roles'; end if;
 if p_slug is null or p_slug !~ '^[a-z][a-z0-9_]{2,39}$' then raise exception 'Invalid role code'; end if;
 if p_slug in ('superuser','pending') then raise exception 'Protected role'; end if;
 if p_action not in ('create','update','delete') then raise exception 'Invalid operation'; end if;
 if p_action='create' then
  if length(btrim(coalesce(p_name,''))) not between 2 and 80 then raise exception 'Role name required'; end if;
  insert into public.app_roles(slug,name,description,active,is_system)
  values(p_slug,btrim(p_name),coalesce(p_description,''),coalesce(p_active,true),false);
 else
  select * into old_role from public.app_roles where slug=p_slug for update;
  if not found then raise exception 'Role not found'; end if;
  if p_action='delete' then
   if old_role.is_system then raise exception 'Built-in role cannot be deleted'; end if;
   if exists(select 1 from public.profiles where role=p_slug) then raise exception 'Role assigned to employees'; end if;
   delete from public.app_roles where slug=p_slug;
   insert into public.role_audit(actor_id,action,subject) values(actor,'role.deleted',p_slug);
   return jsonb_build_object('ok',true,'deleted',p_slug);
  end if;
  if length(btrim(coalesce(p_name,''))) not between 2 and 80 then raise exception 'Role name required'; end if;
  update public.app_roles set name=btrim(p_name),description=coalesce(p_description,''),
  active=coalesce(p_active,true) where slug=p_slug;
 end if;
 if coalesce(array_length(p_permissions,1),0)>100 then raise exception 'Too many permissions'; end if;
 if exists(select 1 from unnest(coalesce(p_permissions,array[]::text[])) k
  where not exists(select 1 from public.app_permissions perm where perm.key=k)) then raise exception 'Unknown permission'; end if;
 delete from public.app_role_permissions where role_slug=p_slug;
 insert into public.app_role_permissions(role_slug,permission_key)
 select p_slug,k from unnest(coalesce(p_permissions,array[]::text[])) k group by k;
 insert into public.role_audit(actor_id,action,subject,detail)
 values(actor,'role.'||p_action,p_slug,jsonb_build_object('permissions',to_jsonb(p_permissions),'active',p_active));
 return jsonb_build_object('ok',true,'slug',p_slug);
end $function$
;
