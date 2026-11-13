create or replace function private.can_view_task(p_task uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists (select 1 from public.tasks t where t.id=p_task and
 (private.user_role(auth.uid()) in ('production_head','creator','stylist','sales_head')
 or (private.user_role(auth.uid())='sales_manager' and t.created_by=auth.uid())
 or (private.user_role(auth.uid())='designer' and exists(select 1 from public.categories c where c.id=t.category_id and c.route='design') and t.ai_approved_at is not null and (t.designer_id is null or t.designer_id=auth.uid()))))
$$;

create or replace function private.can_view_slot(p_slot uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.asset_slots s join public.tasks t on t.id=s.task_id
 where s.id=p_slot and private.can_view_task(t.id) and
 (private.user_role(auth.uid())<>'designer' or (s.kind='ai' and s.review_state='approved' and t.ai_approved_at is not null) or (s.kind='design' and t.ai_approved_at is not null)) and
 (private.user_role(auth.uid()) not in ('sales_manager','sales_head')
  or s.kind in ('manager_reference','test_screenshot')
  or (s.kind='ai' and s.review_state='approved' and t.ai_approved_at is not null)
  or (s.kind='design' and s.review_state='approved' and t.status='completed')))
$$;

create or replace function private.can_upload_asset(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.asset_slots s join public.tasks t on t.id=s.task_id
 where split_part(p_path,'/',1)=t.id::text and split_part(p_path,'/',2)=s.id::text
 and (
 (s.kind='manager_reference' and auth.uid()=t.created_by and t.status not in ('completed','cancelled'))
 or (s.kind='stylist_reference' and private.user_role(auth.uid())='stylist' and (t.stylist_id is null or t.stylist_id=auth.uid()) and t.status='stylist')
 or (s.kind='ai' and auth.uid()=t.creator_id and t.status in ('in_progress','rework'))
 or (s.kind='design' and private.user_role(auth.uid())='designer' and (t.designer_id is null or t.designer_id=auth.uid()) and t.status in ('design','design_rework'))
 or (s.kind='test_screenshot' and auth.uid()=t.created_by and t.status='testing')
 ))
$$;

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
 or (k='stylist_reference' and private.user_role(auth.uid())='stylist' and (t.stylist_id is null or t.stylist_id=auth.uid()) and t.status='stylist')
 or (k='ai' and auth.uid()=t.creator_id and t.status in ('in_progress','rework'))
 or (k='design' and private.user_role(auth.uid())='designer' and (t.designer_id is null or t.designer_id=auth.uid()) and t.status in ('design','design_rework'))
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
 or (k='stylist_reference' and private.user_role(auth.uid())='stylist' and (t.stylist_id is null or t.stylist_id=auth.uid()) and t.status='stylist')
 or (k='ai' and auth.uid()=t.creator_id and t.status in ('in_progress','rework') and (s.current_version_id is null or s.review_state='rejected'))
 or (k='design' and private.user_role(auth.uid())='designer' and (t.designer_id is null or t.designer_id=auth.uid()) and t.status in ('design','design_rework'))
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
