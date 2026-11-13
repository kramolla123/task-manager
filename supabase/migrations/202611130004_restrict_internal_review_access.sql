drop policy if exists rejection_read on public.review_rejections;
create policy rejection_read on public.review_rejections for select to authenticated
using (private.can_view_task(task_id) and (
 private.user_role((select auth.uid()))='production_head'
 or creator_id=(select auth.uid())
 or reviewer_id=(select auth.uid())
));
-- Keep production-only analytics restricted to the production head.
-- Restrict designer submissions from sales until final design approval.
drop policy if exists design_read on public.design_submissions;
create policy design_read on public.design_submissions for select to authenticated
using(private.can_view_task(task_id) and
 (private.user_role((select auth.uid())) not in ('sales_manager','sales_head')
 or exists (select 1 from public.tasks t where t.id=task_id and t.status='completed')));
