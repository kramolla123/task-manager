
create or replace function private.can_view_task(p_task uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tasks t where t.id=p_task and (
 private.has_permission(auth.uid(),'tasks.view_all')
 or (private.has_permission(auth.uid(),'tasks.view_own') and auth.uid() in (t.created_by,t.creator_id,t.stylist_id,t.designer_id))
 or (private.has_permission(auth.uid(),'tasks.view_design') and t.ai_approved_at is not null
     and exists(select 1 from public.categories c where c.id=t.category_id and c.route='design')
     and (t.designer_id is null or t.designer_id=auth.uid()))
 ))
$$;
create or replace function private.can_view_slot(p_slot uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.asset_slots s join public.tasks t on t.id=s.task_id
 where s.id=p_slot and private.can_view_task(t.id)
 and (
   private.has_permission(auth.uid(),'files.view_internal')
   or (private.has_permission(auth.uid(),'files.view_approved') and (
      s.kind in ('manager_reference','test_screenshot')
      or (s.kind='ai' and s.review_state='approved' and t.ai_approved_at is not null)
      or (s.kind='design' and s.review_state='approved' and t.status='completed')))
   or (private.has_permission(auth.uid(),'files.view_design') and (
      (s.kind='ai' and s.review_state='approved' and t.ai_approved_at is not null)
      or (s.kind='design' and t.ai_approved_at is not null)))
 ))
$$;
create or replace function private.can_read_asset(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.asset_versions v join public.asset_slots s on s.id=v.slot_id
 where v.storage_path=p_path and private.can_view_slot(v.slot_id)
 and (private.has_permission(auth.uid(),'files.view_versions') or v.id=s.current_version_id))
$$;
create or replace function private.can_upload_asset(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.asset_slots s join public.tasks t on t.id=s.task_id
 where split_part(p_path,'/',1)=t.id::text and split_part(p_path,'/',2)=s.id::text and (
 (s.kind='manager_reference' and private.has_permission(auth.uid(),'files.upload_manager') and auth.uid()=t.created_by and t.status not in ('completed','cancelled'))
 or (s.kind='stylist_reference' and private.has_permission(auth.uid(),'files.upload_stylist') and (t.stylist_id is null or t.stylist_id=auth.uid()) and t.status='stylist')
 or (s.kind='ai' and private.has_permission(auth.uid(),'files.upload_ai') and auth.uid()=t.creator_id and t.status in ('in_progress','rework'))
 or (s.kind='design' and private.has_permission(auth.uid(),'files.upload_design') and (t.designer_id is null or t.designer_id=auth.uid()) and t.status in ('design','design_rework'))
 or (s.kind='test_screenshot' and private.has_permission(auth.uid(),'files.upload_test') and auth.uid()=t.created_by and t.status='testing')
 ))
$$;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or private.has_permission((select auth.uid()),'staff.view'));
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to authenticated using(private.has_permission((select auth.uid()),'categories.view'));
drop policy if exists categories_admin_insert on public.categories;
create policy categories_admin_insert on public.categories for insert to authenticated with check(private.has_permission((select auth.uid()),'categories.manage'));
drop policy if exists categories_admin_update on public.categories;
create policy categories_admin_update on public.categories for update to authenticated using(private.has_permission((select auth.uid()),'categories.manage')) with check(private.has_permission((select auth.uid()),'categories.manage'));
drop policy if exists versions_read on public.asset_versions;
create policy versions_read on public.asset_versions for select to authenticated using(private.can_view_slot(slot_id) and (private.has_permission((select auth.uid()),'files.view_versions') or id=(select current_version_id from public.asset_slots where asset_slots.id=slot_id)));
drop policy if exists events_read on public.task_events;
create policy events_read on public.task_events for select to authenticated using(private.can_view_task(task_id) and private.has_permission((select auth.uid()),'history.view'));
drop policy if exists rejection_read on public.review_rejections;
create policy rejection_read on public.review_rejections for select to authenticated using(private.can_view_task(task_id) and ((private.has_permission((select auth.uid()),'review.view') and (creator_id=(select auth.uid()) or reviewer_id=(select auth.uid()))) or private.has_permission((select auth.uid()),'analytics.rejections')));
drop policy if exists design_read on public.design_submissions;
create policy design_read on public.design_submissions for select to authenticated using(private.can_view_task(task_id) and (private.has_permission((select auth.uid()),'files.view_internal') or private.has_permission((select auth.uid()),'files.view_design') or exists(select 1 from public.tasks t where t.id=task_id and t.status='completed')));
drop policy if exists comments_read on public.task_comments;
create policy comments_read on public.task_comments for select to authenticated using(private.can_view_task(task_id) and private.has_permission((select auth.uid()),'comments.view'));
drop policy if exists comments_write on public.task_comments;
create policy comments_write on public.task_comments for insert to authenticated with check(private.can_view_task(task_id) and author_id=(select auth.uid()) and private.has_permission((select auth.uid()),'comments.write') and exists(select 1 from public.tasks where id=task_id and status not in ('completed','cancelled')));
