
create table if not exists public.app_roles(
 slug text primary key check(slug ~ '^[a-z][a-z0-9_]{2,39}$'),
 name text not null check(length(btrim(name)) between 2 and 80),
 description text not null default '',
 is_system boolean not null default false,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.app_permissions(
 key text primary key, label text not null, group_name text not null
);
create table if not exists public.app_role_permissions(
 role_slug text not null references public.app_roles(slug) on delete cascade,
 permission_key text not null references public.app_permissions(key) on delete restrict,
 primary key(role_slug,permission_key)
);
create index if not exists app_role_permissions_key_idx on public.app_role_permissions(permission_key);
create table if not exists public.role_audit(
 id bigint generated always as identity primary key,
 actor_id uuid references public.profiles(id),
 action text not null,
 subject text not null,
 detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
insert into public.app_roles(slug,name,is_system) values
 ('pending','Ожидает назначения',true),
 ('superuser','Superuser',true),
 ('production_head','Руководитель производства',true),
 ('sales_head','Руководитель продаж',true),
 ('sales_manager','Менеджер продаж',true),
 ('creator','AI-креатор',true),
 ('stylist','Стилист',true),
 ('designer','Дизайнер',true) on conflict(slug) do nothing;
insert into public.app_permissions(key,label,group_name) values
('tasks.view_all','Смотреть все заявки','Заявки'),
('tasks.view_own','Смотреть свои заявки','Заявки'),
('tasks.view_design','Смотреть заявки на дизайн','Заявки'),
('tasks.create','Создавать заявки','Заявки'),
('tasks.claim','Брать заявку в работу','Заявки'),
('tasks.assign','Назначать исполнителей','Заявки'),
('tasks.edit_all','Редактировать любые заявки','Заявки'),
('tasks.edit_own','Редактировать свои заявки','Заявки'),
('tasks.cancel_all','Отменять любые заявки','Заявки'),
('tasks.cancel_own','Отменять свои заявки','Заявки'),
('tasks.deadline','Изменять дедлайны','Заявки'),
('workflow.override','Работать вместо назначенного исполнителя','Заявки'),
('styling.request','Запрашивать стилизацию','Стилизация'),
('styling.finish','Завершать стилизацию','Стилизация'),
('styling.review','Давать заключение стилиста','Стилизация'),
('ai.submit','Отправлять AI на проверку','AI-контент'),
('ai.approve','Утверждать AI','AI-контент'),
('ai.reject','Возвращать AI на доработку','AI-контент'),
('testing.start','Начинать тестирование','Тестирование'),
('testing.finish','Вносить CTR и завершать тест','Тестирование'),
('design.submit','Отправлять результат дизайна','Дизайн'),
('design.approve','Утверждать дизайн','Дизайн'),
('design.reject','Возвращать дизайн на доработку','Дизайн'),
('files.view_internal','Видеть внутренние материалы','Материалы'),
('files.view_approved','Видеть утверждённые результаты','Материалы'),
('files.view_design','Видеть согласованный AI и свой дизайн','Материалы'),
('files.view_versions','Просматривать историю версий','Материалы'),
('files.upload_manager','Загружать референсы менеджера','Материалы'),
('files.upload_stylist','Загружать референсы стилиста','Материалы'),
('files.upload_ai','Загружать AI-изображения','Материалы'),
('files.upload_design','Загружать дизайн','Материалы'),
('files.upload_test','Загружать скриншоты теста','Материалы'),
('staff.view','Просматривать сотрудников','Управление'),
('employees.manage','Управлять сотрудниками','Управление'),
('employees.manage_sales','Управлять менеджерами продаж','Управление'),
('categories.view','Просматривать категории','Управление'),
('categories.manage','Управлять категориями','Управление'),
('comments.view','Читать внутренние комментарии','Обсуждения и история'),
('comments.write','Писать внутренние комментарии','Обсуждения и история'),
('history.view','Просматривать историю','Обсуждения и история'),
('review.view','Просматривать замечания к материалам','Обсуждения и история'),
('analytics.view','Смотреть аналитику','Аналитика'),
('analytics.rejections','Смотреть статистику правок','Аналитика')
on conflict(key) do update set label=excluded.label,group_name=excluded.group_name;
insert into public.app_role_permissions(role_slug,permission_key) values
('production_head','tasks.view_all'),
('production_head','tasks.view_own'),
('production_head','tasks.view_design'),
('production_head','tasks.create'),
('production_head','tasks.claim'),
('production_head','tasks.assign'),
('production_head','tasks.edit_all'),
('production_head','tasks.edit_own'),
('production_head','tasks.cancel_all'),
('production_head','tasks.cancel_own'),
('production_head','tasks.deadline'),
('production_head','workflow.override'),
('production_head','styling.request'),
('production_head','styling.finish'),
('production_head','styling.review'),
('production_head','ai.submit'),
('production_head','ai.approve'),
('production_head','ai.reject'),
('production_head','testing.start'),
('production_head','testing.finish'),
('production_head','design.submit'),
('production_head','design.approve'),
('production_head','design.reject'),
('production_head','files.view_internal'),
('production_head','files.view_approved'),
('production_head','files.view_design'),
('production_head','files.view_versions'),
('production_head','files.upload_manager'),
('production_head','files.upload_stylist'),
('production_head','files.upload_ai'),
('production_head','files.upload_design'),
('production_head','files.upload_test'),
('production_head','staff.view'),
('production_head','employees.manage'),
('production_head','employees.manage_sales'),
('production_head','categories.view'),
('production_head','categories.manage'),
('production_head','comments.view'),
('production_head','comments.write'),
('production_head','history.view'),
('production_head','review.view'),
('production_head','analytics.view'),
('production_head','analytics.rejections'),
('sales_head','tasks.view_all'),
('sales_head','tasks.create'),
('sales_head','tasks.edit_all'),
('sales_head','tasks.cancel_all'),
('sales_head','files.view_approved'),
('sales_head','staff.view'),
('sales_head','employees.manage_sales'),
('sales_head','categories.view'),
('sales_head','analytics.view'),
('sales_manager','tasks.view_own'),
('sales_manager','tasks.create'),
('sales_manager','tasks.edit_own'),
('sales_manager','tasks.cancel_own'),
('sales_manager','testing.start'),
('sales_manager','testing.finish'),
('sales_manager','files.view_approved'),
('sales_manager','files.upload_manager'),
('sales_manager','files.upload_test'),
('sales_manager','staff.view'),
('sales_manager','categories.view'),
('creator','tasks.view_all'),
('creator','tasks.claim'),
('creator','styling.request'),
('creator','ai.submit'),
('creator','files.view_internal'),
('creator','files.view_versions'),
('creator','files.upload_ai'),
('creator','staff.view'),
('creator','categories.view'),
('creator','comments.view'),
('creator','comments.write'),
('creator','history.view'),
('creator','review.view'),
('stylist','tasks.view_all'),
('stylist','styling.finish'),
('stylist','styling.review'),
('stylist','files.view_internal'),
('stylist','files.view_versions'),
('stylist','files.upload_stylist'),
('stylist','staff.view'),
('stylist','categories.view'),
('stylist','comments.view'),
('stylist','comments.write'),
('stylist','history.view'),
('stylist','review.view'),
('designer','tasks.view_design'),
('designer','design.submit'),
('designer','files.view_design'),
('designer','files.upload_design'),
('designer','staff.view'),
('designer','categories.view'),
('designer','comments.view'),
('designer','comments.write'),
('designer','history.view'),
('designer','review.view')
on conflict do nothing;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_fk foreign key(role) references public.app_roles(slug);
create or replace function private.has_permission(p_uid uuid,p_key text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
   select 1 from public.profiles p join public.app_roles r on r.slug=p.role
   where p.id=p_uid and p.active and r.active
   and (r.slug='superuser' or exists(
     select 1 from public.app_role_permissions rp where rp.role_slug=p.role and rp.permission_key=p_key
   ))
  )
$$;
create or replace function public.manage_role(
 p_action text,p_slug text,p_name text default null,p_description text default null,
 p_permissions text[] default array[]::text[],p_active boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); old_role public.app_roles%rowtype;
begin
 if actor is null or private.user_role(actor)<>'superuser' then raise exception 'Only superuser can manage roles'; end if;
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
end $$;
create or replace function public.manage_employee(p_user_id uuid,p_role text,p_active boolean default true)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); caller text; old_role text;
begin
 caller:=private.user_role(actor);
 if actor is null or not (private.has_permission(actor,'employees.manage')
    or private.has_permission(actor,'employees.manage_sales')) then raise exception 'Forbidden'; end if;
 if not exists(select 1 from public.app_roles where slug=p_role and active) then raise exception 'Unknown or disabled role'; end if;
 select role into old_role from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Employee not found'; end if;
 if caller<>'superuser' and (p_role='superuser' or old_role='superuser') then raise exception 'Protected superuser'; end if;
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
end $$;
alter table public.app_roles enable row level security;
alter table public.app_permissions enable row level security;
alter table public.app_role_permissions enable row level security;
alter table public.role_audit enable row level security;
create policy app_roles_read on public.app_roles for select to authenticated using(true);
create policy app_permissions_read on public.app_permissions for select to authenticated using(true);
create policy app_role_permissions_read on public.app_role_permissions for select to authenticated using(true);
create policy role_audit_read on public.role_audit for select to authenticated using(private.user_role((select auth.uid()))='superuser');
revoke all on public.app_roles,public.app_permissions,public.app_role_permissions,public.role_audit from anon,authenticated;
grant select on public.app_roles,public.app_permissions,public.app_role_permissions to authenticated;
grant select on public.role_audit to authenticated;
revoke all on function private.has_permission(uuid,text) from public,anon;
grant execute on function private.has_permission(uuid,text) to authenticated;
revoke all on function public.manage_role(text,text,text,text,text[],boolean) from public,anon;
grant execute on function public.manage_role(text,text,text,text,text[],boolean) to authenticated;
revoke all on function public.manage_employee(uuid,text,boolean) from public,anon;
grant execute on function public.manage_employee(uuid,text,boolean) to authenticated;
