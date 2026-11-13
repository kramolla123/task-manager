
create or replace function private.can_read_asset(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.asset_versions v join public.asset_slots s on s.id=v.slot_id
 where v.storage_path=p_path and private.can_view_slot(v.slot_id)
 and (v.id=s.current_version_id or (
  private.has_permission(auth.uid(),'files.view_internal')
  and private.has_permission(auth.uid(),'files.view_versions')
 )))
$$;
drop policy if exists versions_read on public.asset_versions;
create policy versions_read on public.asset_versions for select to authenticated using(
 private.can_view_slot(slot_id) and (
 id=(select current_version_id from public.asset_slots where asset_slots.id=slot_id)
 or (private.has_permission((select auth.uid()),'files.view_internal')
     and private.has_permission((select auth.uid()),'files.view_versions'))
 ));
