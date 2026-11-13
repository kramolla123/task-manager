-- Replace fixed-role checks with configurable RBAC authorization.
CREATE OR REPLACE FUNCTION public.task_transition(p_type text, p_task_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 uid uuid:=auth.uid(); role_name text; t public.tasks%rowtype; c public.categories%rowtype;
 newly public.tasks%rowtype; selected_ids uuid[]; selected_count integer; image_count integer;
 missing_count integer; pending_stylist boolean; target uuid; reason text; stage text; s public.asset_slots%rowtype;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 role_name:=private.user_role(uid);
 if role_name='pending' then raise exception 'Role not assigned'; end if;
 if p_type='create' then
  if not private.has_permission(uid,'tasks.create') then raise exception 'Not allowed to create'; end if;
  select * into c from public.categories where id=(p_payload->>'category_id')::uuid and active;
  if not found then raise exception 'Category not available'; end if;
  if nullif(btrim(p_payload->>'ld_article'),'') is null then raise exception 'LD article required'; end if;
  insert into public.tasks(category_id,product_url,ld_article,description,requested_photos,source_url,priority,created_by,deadline_at)
  values(c.id,coalesce(p_payload->>'product_url',''),btrim(p_payload->>'ld_article'),coalesce(p_payload->>'description',''),
   coalesce((p_payload->>'requested_photos')::integer,9),coalesce(p_payload->>'source_url',''),
   coalesce(p_payload->>'priority','Medium'),uid,now()+make_interval(days=>c.deadline_days))
  returning * into newly;
  insert into public.task_events(task_id,actor_id,action,details) values(newly.id,uid,'created',jsonb_build_object('category',c.name,'deadline_days',c.deadline_days));
  return jsonb_build_object('task',to_jsonb(newly));
 end if;
 if p_type<>'action' then raise exception 'Invalid command type'; end if;
 select * into t from public.tasks where id=p_task_id for update;
 if not found or not private.can_view_task(p_task_id) then raise exception 'Not found or forbidden'; end if;
 if p_action in ('update','deadline') and (p_payload->>'expected_version')::integer is distinct from t.version then raise exception 'Version conflict: reload task before editing' using errcode='40001'; end if;
 if t.status in ('completed','cancelled') then raise exception 'Task is closed'; end if;
 stage:=t.status;
 case p_action
 when 'claim' then
  if not private.has_permission(uid,'tasks.claim') or t.status<>'to_do' or t.creator_id is not null then raise exception 'Cannot claim'; end if;
  update public.tasks set creator_id=uid,status='in_progress' where id=t.id;
 when 'set_stylist' then
  if (not private.has_permission(uid,'styling.request') or not (uid=t.creator_id or private.has_permission(uid,'workflow.override'))) or t.status<>'in_progress' or t.current_cycle<>0 then raise exception 'Cannot choose stylist'; end if;
  if coalesce((p_payload->>'required')::boolean,false) then
   target:=(p_payload->>'stylist_id')::uuid;
   if target is not null and not private.has_permission(target,'styling.finish') then raise exception 'Invalid stylist'; end if;
   update public.tasks set stylist_required=true,stylist_id=target,status='stylist' where id=t.id;
  else update public.tasks set stylist_required=false,status='in_progress' where id=t.id; end if;
 when 'finish_stylist' then
  if not private.has_permission(uid,'styling.finish') or t.status<>'stylist' or (t.stylist_id is not null and t.stylist_id<>uid and not private.has_permission(uid,'workflow.override')) then raise exception 'Cannot finish styling'; end if;
  update public.tasks set status='in_progress',stylist_id=case when t.stylist_id is null then uid else t.stylist_id end where id=t.id;
 when 'submit_ai' then
  if (not private.has_permission(uid,'ai.submit') or not (uid=t.creator_id or private.has_permission(uid,'workflow.override'))) or t.status not in ('in_progress','rework') then raise exception 'Cannot submit AI'; end if;
  select count(*) into image_count from public.asset_slots where task_id=t.id and kind='ai' and current_version_id is not null;
  select count(*) into missing_count from public.asset_slots where task_id=t.id and kind='ai' and (current_version_id is null or review_state='rejected');
  if image_count=0 or missing_count>0 then raise exception 'Missing AI images or replacements'; end if;
  update public.tasks set status='review',current_cycle=t.current_cycle+1,stylist_reviewed_cycle=null where id=t.id;
 when 'stylist_review' then
  if not private.has_permission(uid,'styling.review') or t.status<>'review' then raise exception 'Cannot review style'; end if;
  if t.stylist_id is not null and uid<>t.stylist_id and not private.has_permission(uid,'workflow.override') then raise exception 'Not assigned stylist'; end if;
  update public.tasks set stylist_reviewed_cycle=t.current_cycle where id=t.id;
 when 'reject_ai' then
  if not private.has_permission(uid,'ai.reject') or t.status<>'review' then raise exception 'Not allowed to reject'; end if;
  reason:=nullif(btrim(p_payload->>'reason'),'');
  if reason is null then raise exception 'Rejection reason required'; end if;
  select array_agg(distinct z::uuid) into selected_ids from jsonb_array_elements_text(coalesce(p_payload->'slot_ids','[]'::jsonb)) z;
  if selected_ids is null or cardinality(selected_ids)=0 then raise exception 'Select images to reject'; end if;
  select count(*) into selected_count from public.asset_slots where task_id=t.id and kind='ai' and id=any(selected_ids) and current_version_id is not null;
  if selected_count<>cardinality(selected_ids) then raise exception 'Invalid selected image'; end if;
  for s in select * from public.asset_slots where id=any(selected_ids) loop
   insert into public.review_rejections(task_id,slot_id,version_id,cycle,stage,creator_id,reason,comment,reviewer_id)
   values(t.id,s.id,s.current_version_id,t.current_cycle,'ai',t.creator_id,reason,coalesce(p_payload->>'comment',''),uid);
  end loop;
  update public.asset_slots set review_state='rejected' where id=any(selected_ids);
  update public.asset_slots set review_state='approved' where task_id=t.id and kind='ai' and id<>all(selected_ids) and current_version_id is not null;
  update public.tasks set status='rework' where id=t.id;
 when 'approve_ai' then
  if not private.has_permission(uid,'ai.approve') or t.status<>'review' then raise exception 'Not allowed to approve AI'; end if;
  if t.stylist_required and t.stylist_reviewed_cycle is distinct from t.current_cycle then
   reason:=nullif(btrim(p_payload->>'bypass_reason'),'');
   if reason is null then raise exception 'Stylist conclusion absent: bypass reason required'; end if;
   insert into public.task_events(task_id,actor_id,action,details) values(t.id,uid,'stylist_bypass',jsonb_build_object('reason',reason,'cycle',t.current_cycle));
  end if;
  select count(*) into image_count from public.asset_slots where task_id=t.id and kind='ai' and current_version_id is not null;
  select count(*) into missing_count from public.asset_slots where task_id=t.id and kind='ai' and (current_version_id is null or review_state='rejected');
  if image_count=0 or missing_count>0 then raise exception 'AI image set incomplete'; end if;
  select * into c from public.categories where id=t.category_id;
  update public.asset_slots set review_state='approved' where task_id=t.id and kind='ai' and current_version_id is not null;
  update public.tasks set ai_approved_at=now(),status=case when c.route='design' then 'design' else 'ready' end,stylist_bypass_reason=reason where id=t.id;
 when 'start_test' then
  if (not private.has_permission(uid,'testing.start') or not (uid=t.created_by or private.has_permission(uid,'workflow.override'))) or t.status<>'ready' then raise exception 'Cannot start test'; end if;
  update public.tasks set status='testing' where id=t.id;
 when 'finish_test' then
  if (not private.has_permission(uid,'testing.finish') or not (uid=t.created_by or private.has_permission(uid,'workflow.override'))) or t.status<>'testing' then raise exception 'Cannot finish test'; end if;
  if (p_payload->>'ctr_best')::numeric < (p_payload->>'ctr_worst')::numeric then raise exception 'CTR best must be >= worst'; end if;
  insert into public.test_results(task_id,ctr_best,ctr_worst,used_main,notes)
  values(t.id,(p_payload->>'ctr_best')::numeric,(p_payload->>'ctr_worst')::numeric,(p_payload->>'used_main')::boolean,coalesce(p_payload->>'notes',''));
  update public.tasks set status='completed',completed_at=now() where id=t.id;
 when 'assign' then
  if not private.has_permission(uid,'tasks.assign') then raise exception 'Not allowed to assign'; end if;
  if p_payload ? 'creator_id' then
   target:=(p_payload->>'creator_id')::uuid;
   if not private.has_permission(target,'tasks.claim') then raise exception 'Invalid creator'; end if;
   update public.tasks set creator_id=target,status=case when t.status='to_do' then 'in_progress' else t.status end where id=t.id;
  end if;
  if p_payload ? 'designer_id' then
   target:=(p_payload->>'designer_id')::uuid;
   if not private.has_permission(target,'design.submit') then raise exception 'Invalid designer'; end if;
   update public.tasks set designer_id=target where id=t.id;
  end if;
 when 'submit_design' then
  if not private.has_permission(uid,'design.submit') or t.status not in ('design','design_rework') then raise exception 'Cannot submit design'; end if;
  if t.designer_id is not null and t.designer_id<>uid and not private.has_permission(uid,'workflow.override') then raise exception 'Not assigned'; end if;
  if nullif(btrim(p_payload->>'canva_url'),'') is null and not exists(select 1 from public.asset_slots where task_id=t.id and kind='design' and current_version_id is not null) then raise exception 'Canva URL or design file required'; end if;
  insert into public.design_submissions(task_id,cycle,canva_url,notes)
   values(t.id,t.design_cycle+1,coalesce(p_payload->>'canva_url',''),coalesce(p_payload->>'notes',''));
  update public.tasks set status='design_review',design_cycle=t.design_cycle+1,
   designer_id=coalesce(t.designer_id,case when private.has_permission(uid,'design.submit') then uid else null end) where id=t.id;
 when 'approve_design' then
  if not private.has_permission(uid,'design.approve') or t.status<>'design_review' then raise exception 'Cannot approve design'; end if;
  update public.asset_slots set review_state='approved' where task_id=t.id and kind='design';
  update public.tasks set status='completed',completed_at=now() where id=t.id;
 when 'reject_design' then
  if not private.has_permission(uid,'design.reject') or t.status<>'design_review' then raise exception 'Cannot reject design'; end if;
  reason:=nullif(btrim(p_payload->>'reason'),''); if reason is null then raise exception 'Reason required'; end if;
  select array_agg(distinct z::uuid) into selected_ids from jsonb_array_elements_text(coalesce(p_payload->'slot_ids','[]'::jsonb)) z;
  if selected_ids is null then
   select array_agg(id) into selected_ids from public.asset_slots where task_id=t.id and kind='design' and current_version_id is not null;
  end if;
  if selected_ids is not null then
   if (select count(*) from public.asset_slots where task_id=t.id and kind='design' and id=any(selected_ids))<>cardinality(selected_ids) then raise exception 'Invalid image selection'; end if;
   for s in select * from public.asset_slots where id=any(selected_ids) loop
    insert into public.review_rejections(task_id,slot_id,version_id,cycle,stage,creator_id,reason,comment,reviewer_id)
     values(t.id,s.id,s.current_version_id,t.design_cycle,'design',t.designer_id,reason,coalesce(p_payload->>'comment',''),uid);
   end loop;
   update public.asset_slots set review_state='rejected' where id=any(selected_ids);
  else
   insert into public.review_rejections(task_id,slot_id,version_id,cycle,stage,creator_id,reason,comment,reviewer_id)
    values(t.id,null,null,t.design_cycle,'design',t.designer_id,reason,coalesce(p_payload->>'comment',''),uid);
  end if;
  update public.tasks set status='design_rework' where id=t.id;
 when 'update' then
  if not (private.has_permission(uid,'tasks.edit_all') or (private.has_permission(uid,'tasks.edit_own') and t.created_by=uid)) then raise exception 'Cannot edit'; end if;
  update public.tasks set
   product_url=coalesce(p_payload->>'product_url',t.product_url),
   ld_article=coalesce(p_payload->>'ld_article',t.ld_article),
   description=coalesce(p_payload->>'description',t.description),
   requested_photos=coalesce((p_payload->>'requested_photos')::integer,t.requested_photos),
   source_url=coalesce(p_payload->>'source_url',t.source_url),
   priority=coalesce(p_payload->>'priority',t.priority) where id=t.id;
 when 'deadline' then
  if not private.has_permission(uid,'tasks.deadline') then raise exception 'Not allowed to change deadline'; end if;
  reason:=nullif(btrim(p_payload->>'reason'),'');
  if reason is null then raise exception 'Deadline change reason required'; end if;
  update public.tasks set deadline_at=(p_payload->>'deadline_at')::timestamptz where id=t.id;
 when 'cancel' then
  if not (private.has_permission(uid,'tasks.cancel_all') or (private.has_permission(uid,'tasks.cancel_own') and uid=t.created_by)) then raise exception 'Not allowed'; end if;
  reason:=nullif(btrim(p_payload->>'reason'),'');if reason is null then raise exception 'Cancellation reason required';end if;
  update public.tasks set status='cancelled' where id=t.id;
 else raise exception 'Unsupported action %',p_action;
 end case;
 update public.tasks set version=version+1,updated_at=now() where id=t.id returning * into newly;
 insert into public.task_events(task_id,actor_id,action,details)
 values(t.id,uid,p_action,jsonb_build_object('before',to_jsonb(t),'after',to_jsonb(newly),'payload',coalesce(p_payload,'{}'::jsonb)));
 return jsonb_build_object('task',to_jsonb(newly));
end $function$
;

CREATE OR REPLACE FUNCTION public.asset_command(p_task_id uuid, p_command text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 declare t public.tasks%rowtype; s public.asset_slots%rowtype; k text; v int; vid uuid; path text; fname text; mime text;
 begin
 select * into t from public.tasks where id=p_task_id for update;
 if not found or not private.can_view_task(p_task_id) then raise exception 'Not allowed'; end if;
 if p_command='create_slot' then
 k:=p_payload->>'kind';
 if not (
 (k='manager_reference' and private.has_permission(auth.uid(),'files.upload_manager') and auth.uid()=t.created_by and t.status not in ('completed','cancelled'))
 or (k='stylist_reference' and private.has_permission(auth.uid(),'files.upload_stylist') and (t.stylist_id is null or t.stylist_id=auth.uid()) and t.status='stylist')
 or (k='ai' and private.has_permission(auth.uid(),'files.upload_ai') and auth.uid()=t.creator_id and t.status in ('in_progress','rework'))
 or (k='design' and private.has_permission(auth.uid(),'files.upload_design') and (t.designer_id is null or t.designer_id=auth.uid()) and t.status in ('design','design_rework'))
 or (k='test_screenshot' and private.has_permission(auth.uid(),'files.upload_test') and auth.uid()=t.created_by and t.status='testing')
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
 (k='manager_reference' and private.has_permission(auth.uid(),'files.upload_manager') and auth.uid()=t.created_by and t.status not in ('completed','cancelled'))
 or (k='stylist_reference' and private.has_permission(auth.uid(),'files.upload_stylist') and (t.stylist_id is null or t.stylist_id=auth.uid()) and t.status='stylist')
 or (k='ai' and private.has_permission(auth.uid(),'files.upload_ai') and auth.uid()=t.creator_id and t.status in ('in_progress','rework') and (s.current_version_id is null or s.review_state='rejected'))
 or (k='design' and private.has_permission(auth.uid(),'files.upload_design') and (t.designer_id is null or t.designer_id=auth.uid()) and t.status in ('design','design_rework'))
 or (k='test_screenshot' and private.has_permission(auth.uid(),'files.upload_test') and auth.uid()=t.created_by and t.status='testing')
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
 end $function$
;
