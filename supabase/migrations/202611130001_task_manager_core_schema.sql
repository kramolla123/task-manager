
create schema if not exists private;
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 telegram text not null default '',
 role text not null default 'pending' check(role in ('pending','production_head','sales_head','sales_manager','creator','stylist','designer')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.categories (
 id uuid primary key default gen_random_uuid(),
 name text not null unique, description text not null default '', instructions text not null default '',
 deadline_days integer not null default 2 check(deadline_days between 1 and 365),
 route text not null check(route in ('testing','design')), active boolean not null default true,
 created_at timestamptz not null default now()
);
insert into public.categories(name,description,instructions,deadline_days,route) values
 ('Тестирование ГФ','AI-фотографии для последующего CTR тестирования','Подготовить комплект главных фотографий',2,'testing'),
 ('Новинка','AI-фотографии нового товара с последующим тестированием','Подготовить изображения нового товара',2,'testing'),
 ('Воронка для ГФ','AI-фотографии для инфографики дизайнера','Подготовить изображения для передачи дизайнеру',2,'design');
create sequence public.task_number_seq start 1;
create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 number bigint not null unique default nextval('public.task_number_seq'),
 category_id uuid not null references public.categories(id),
 product_url text not null default '', ld_article text not null,
 description text not null default '', requested_photos integer not null default 9 check(requested_photos between 1 and 100),
 source_url text not null default '', priority text not null default 'Medium' check(priority in ('Low','Medium','High')),
 created_by uuid not null references public.profiles(id),
 creator_id uuid references public.profiles(id), stylist_id uuid references public.profiles(id),
 designer_id uuid references public.profiles(id),
 status text not null default 'to_do' check(status in ('to_do','stylist','in_progress','review','rework','ready','testing','design','design_review','design_rework','completed','cancelled')),
 stylist_required boolean not null default false, stylist_reviewed_cycle integer,
 stylist_bypass_reason text,
 current_cycle integer not null default 0, design_cycle integer not null default 0,
 deadline_at timestamptz not null, ai_approved_at timestamptz, completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create unique index tasks_active_article_category on public.tasks (lower(btrim(ld_article)),category_id) where status not in ('completed','cancelled');
create index tasks_status_due on public.tasks(status,deadline_at);
create index tasks_created_by on public.tasks(created_by);
create index tasks_creator on public.tasks(creator_id);
create table public.asset_slots(
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id),
 kind text not null check(kind in ('manager_reference','stylist_reference','ai','design','test_screenshot')),
 slot_number integer not null,
 review_state text not null default 'pending' check(review_state in ('pending','approved','rejected')),
 current_version_id uuid, created_at timestamptz not null default now(),
 unique(task_id,kind,slot_number)
);
create table public.asset_versions(
 id uuid primary key default gen_random_uuid(), slot_id uuid not null references public.asset_slots(id),
 version_number int not null, storage_path text not null unique,
 filename text not null, mime_type text not null,
 created_at timestamptz not null default now(), created_by uuid not null references public.profiles(id),
 unique(slot_id,version_number)
);
alter table public.asset_slots add constraint asset_slots_current_version_fk foreign key(current_version_id) references public.asset_versions(id);
create table public.task_events(
 id bigserial primary key,task_id uuid not null references public.tasks(id),
 actor_id uuid references public.profiles(id), action text not null, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index task_events_task_date on public.task_events(task_id,created_at desc);
create table public.review_rejections(
 id bigserial primary key,task_id uuid not null references public.tasks(id),
 slot_id uuid references public.asset_slots(id), version_id uuid references public.asset_versions(id),
 cycle integer not null, stage text not null check(stage in ('ai','design')),
 creator_id uuid references public.profiles(id), reason text not null, comment text not null default '',
 reviewer_id uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 unique(slot_id,cycle,stage)
);
create table public.test_results(
 id uuid primary key default gen_random_uuid(),task_id uuid not null unique references public.tasks(id),
 ctr_best numeric(6,3) not null check(ctr_best between 0 and 100),
 ctr_worst numeric(6,3) not null check(ctr_worst between 0 and 100 and ctr_worst <= ctr_best),
 used_main boolean not null,notes text not null default '',created_at timestamptz not null default now()
);
create table public.design_submissions(
 id uuid primary key default gen_random_uuid(),task_id uuid not null references public.tasks(id),
 cycle int not null,canva_url text not null default '', notes text not null default '',
 created_at timestamptz not null default now(),unique(task_id,cycle)
);
create table public.task_comments(
 id uuid primary key default gen_random_uuid(),task_id uuid not null references public.tasks(id),
 author_id uuid not null references public.profiles(id),body text not null check(length(btrim(body)) between 1 and 10000),
 created_at timestamptz not null default now()
);
create or replace function private.user_role(p_uid uuid) returns text language sql stable security definer set search_path='' as $$
 select case when active then role else 'pending' end from public.profiles where id=p_uid
$$;
create or replace function private.can_view_task(p_task uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists (select 1 from public.tasks t where t.id=p_task and
 (private.user_role(auth.uid()) in ('production_head','creator','stylist','designer','sales_head')
 or (private.user_role(auth.uid())='sales_manager' and t.created_by=auth.uid())))
$$;
create or replace function private.can_view_slot(p_slot uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.asset_slots s join public.tasks t on t.id=s.task_id
 where s.id=p_slot and private.can_view_task(t.id) and
 (private.user_role(auth.uid()) not in ('sales_manager','sales_head')
  or s.kind in ('manager_reference','test_screenshot')
  or (s.kind='ai' and s.review_state='approved' and t.ai_approved_at is not null)
  or (s.kind='design' and s.review_state='approved' and t.status='completed')))
$$;
create or replace function private.can_read_asset(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.asset_versions v where v.storage_path=p_path
 and private.can_view_slot(v.slot_id)
 and (private.user_role(auth.uid()) not in ('sales_manager','sales_head') or v.id=(select current_version_id from public.asset_slots where id=v.slot_id)))
$$;
create or replace function private.can_upload_asset(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.asset_slots s join public.tasks t on t.id=s.task_id
 where split_part(p_path,'/',1)=t.id::text and split_part(p_path,'/',2)=s.id::text
 and (
 (s.kind='manager_reference' and auth.uid()=t.created_by and t.status not in ('completed','cancelled'))
 or (s.kind='stylist_reference' and private.user_role(auth.uid())='stylist' and t.status='stylist')
 or (s.kind='ai' and auth.uid()=t.creator_id and t.status in ('in_progress','rework'))
 or (s.kind='design' and private.user_role(auth.uid())='designer' and t.status in ('design','design_rework'))
 or (s.kind='test_screenshot' and auth.uid()=t.created_by and t.status='testing')
 ))
$$;
create or replace function public.manage_employee(p_user_id uuid,p_role text,p_active boolean default true) returns void
 language plpgsql security definer set search_path='' as $$
 begin
 if private.user_role(auth.uid()) not in ('production_head','sales_head') then raise exception 'Forbidden'; end if;
 if p_role not in ('pending','production_head','sales_head','sales_manager','creator','stylist','designer') then raise exception 'Invalid role'; end if;
 if private.user_role(auth.uid())='sales_head' and (p_role <> 'sales_manager' or not exists(select 1 from public.profiles where id=p_user_id and role in ('pending','sales_manager'))) then raise exception 'Only sales managers'; end if;
 update public.profiles set role=p_role,active=p_active where id=p_user_id;
 if not found then raise exception 'User does not exist'; end if;
 end $$;
create or replace function public.asset_command(p_task_id uuid,p_command text,p_payload jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
 declare t public.tasks%rowtype; s public.asset_slots%rowtype; k text; v int; vid uuid; path text; fname text; mime text;
 begin
 select * into t from public.tasks where id=p_task_id for update;
 if not found or not private.can_view_task(p_task_id) then raise exception 'Not allowed'; end if;
 if p_command='create_slot' then
 k:=p_payload->>'kind';
 if not (
 (k='manager_reference' and auth.uid()=t.created_by and t.status not in ('completed','cancelled'))
 or (k='stylist_reference' and private.user_role(auth.uid())='stylist' and t.status='stylist')
 or (k='ai' and auth.uid()=t.creator_id and t.status in ('in_progress','rework'))
 or (k='design' and private.user_role(auth.uid())='designer' and t.status in ('design','design_rework'))
 or (k='test_screenshot' and auth.uid()=t.created_by and t.status='testing')
 ) then raise exception 'Not permitted for this file kind/stage'; end if;
 insert into public.asset_slots(task_id,kind,slot_number)
 values(p_task_id,k,(select coalesce(max(slot_number),0)+1 from public.asset_slots where task_id=p_task_id and kind=k))
 returning * into s;
 return jsonb_build_object('slot_id',s.id,'version_number',1);
 elsif p_command='add_version' then
 select * into s from public.asset_slots where id=(p_payload->>'slot_id')::uuid and task_id=p_task_id for update;
 if not found then raise exception 'Invalid slot'; end if;
 k:=s.kind;
 if not (
 (k='manager_reference' and auth.uid()=t.created_by and t.status not in ('completed','cancelled'))
 or (k='stylist_reference' and private.user_role(auth.uid())='stylist' and t.status='stylist')
 or (k='ai' and auth.uid()=t.creator_id and t.status in ('in_progress','rework') and (s.current_version_id is null or s.review_state='rejected'))
 or (k='design' and private.user_role(auth.uid())='designer' and t.status in ('design','design_rework'))
 or (k='test_screenshot' and auth.uid()=t.created_by and t.status='testing')
 ) then raise exception 'Not permitted to version this slot'; end if;
 path:=p_payload->>'storage_path'; fname:=p_payload->>'filename'; mime:=p_payload->>'mime_type';
 if path is null or split_part(path,'/',1)<>p_task_id::text or split_part(path,'/',2)<>s.id::text or fname is null or mime not like 'image/%' then raise exception 'Invalid path or type'; end if;
 if not exists(select 1 from storage.objects where bucket_id='task-assets' and name=path and owner_id=auth.uid()::text) then raise exception 'Upload not found'; end if;
 select coalesce(max(version_number),0)+1 into v from public.asset_versions where slot_id=s.id;
 insert into public.asset_versions(slot_id,version_number,storage_path,filename,mime_type,created_by)
 values(s.id,v,path,fname,mime,auth.uid()) returning id into vid;
 update public.asset_slots set current_version_id=vid,review_state='pending' where id=s.id;
 insert into public.task_events(task_id,actor_id,action,details) values(p_task_id,auth.uid(),'asset_version',jsonb_build_object('slot_id',s.id,'kind',k,'version',v));
 return jsonb_build_object('slot_id',s.id,'version_id',vid,'version_number',v);
 end if;
 raise exception 'Unsupported asset command';
 end $$;
create or replace function public.handle_new_profile() returns trigger language plpgsql security definer set search_path='' as $$
 begin insert into public.profiles(id,full_name,telegram) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.raw_user_meta_data->>'telegram','')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_profile();
insert into public.profiles(id,full_name) select id,coalesce(raw_user_meta_data->>'full_name','') from auth.users on conflict do nothing;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.asset_slots enable row level security;
alter table public.asset_versions enable row level security;
alter table public.task_events enable row level security;
alter table public.review_rejections enable row level security;
alter table public.test_results enable row level security;
alter table public.design_submissions enable row level security;
alter table public.task_comments enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (id=(select auth.uid()) or private.user_role((select auth.uid())) in ('production_head','sales_head','creator','stylist','designer','sales_manager'));
create policy profiles_self_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
-- Restrict profile UPDATE to user-editable fields at column privilege level: roles must never be directly mutable.
revoke update on public.profiles from authenticated;
grant update(full_name,telegram) on public.profiles to authenticated;
create policy categories_read on public.categories for select to authenticated using(private.user_role((select auth.uid()))<>'pending');
create policy categories_admin_insert on public.categories for insert to authenticated with check(private.user_role((select auth.uid()))='production_head');
create policy categories_admin_update on public.categories for update to authenticated using(private.user_role((select auth.uid()))='production_head') with check(private.user_role((select auth.uid()))='production_head');
create policy tasks_read on public.tasks for select to authenticated using(private.can_view_task(id));
create policy slots_read on public.asset_slots for select to authenticated using(private.can_view_slot(id));
create policy versions_read on public.asset_versions for select to authenticated using(private.can_view_slot(slot_id) and (private.user_role((select auth.uid())) not in ('sales_manager','sales_head') or id=(select current_version_id from public.asset_slots where asset_slots.id=slot_id)));
create policy events_read on public.task_events for select to authenticated using(private.can_view_task(task_id) and private.user_role((select auth.uid())) not in ('sales_manager','sales_head'));
create policy rejection_read on public.review_rejections for select to authenticated using(private.can_view_task(task_id) and private.user_role((select auth.uid())) not in ('sales_manager','sales_head'));
create policy tests_read on public.test_results for select to authenticated using(private.can_view_task(task_id));
create policy design_read on public.design_submissions for select to authenticated using(private.can_view_task(task_id));
create policy comments_read on public.task_comments for select to authenticated using(private.can_view_task(task_id) and private.user_role((select auth.uid())) not in ('sales_manager','sales_head'));
create policy comments_write on public.task_comments for insert to authenticated with check(private.can_view_task(task_id) and author_id=(select auth.uid()) and private.user_role((select auth.uid())) in ('production_head','creator','stylist','designer') and exists(select 1 from public.tasks where id=task_id and status not in ('completed','cancelled')));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('task-assets','task-assets',false,15728640,array['image/jpeg','image/png','image/webp','image/gif']) on conflict (id) do update set public=false,file_size_limit=15728640,allowed_mime_types=excluded.allowed_mime_types;
create policy task_assets_upload on storage.objects for insert to authenticated with check(bucket_id='task-assets' and private.can_upload_asset(name));
create policy task_assets_read on storage.objects for select to authenticated using(bucket_id='task-assets' and (private.can_read_asset(name) or (owner_id=(select auth.uid())::text and private.can_upload_asset(name))));
-- uploads immutable; replacements create separate object keys
revoke all on function private.user_role(uuid),private.can_view_task(uuid),private.can_view_slot(uuid),private.can_read_asset(text),private.can_upload_asset(text) from public;
grant usage on schema private to authenticated;
grant execute on function private.user_role(uuid),private.can_view_task(uuid),private.can_view_slot(uuid),private.can_read_asset(text),private.can_upload_asset(text) to authenticated;
revoke all on function public.asset_command(uuid,text,jsonb),public.manage_employee(uuid,text,boolean) from public;
grant execute on function public.asset_command(uuid,text,jsonb),public.manage_employee(uuid,text,boolean) to authenticated;
revoke all on all tables in schema public from anon;
grant select on public.profiles,public.categories,public.tasks,public.asset_slots,public.asset_versions,public.task_events,public.review_rejections,public.test_results,public.design_submissions,public.task_comments to authenticated;
grant insert,update on public.categories to authenticated;
grant insert on public.task_comments to authenticated;
