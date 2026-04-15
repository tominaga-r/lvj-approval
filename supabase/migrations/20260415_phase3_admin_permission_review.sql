-- =========================================================
-- Phase 3: admin permission review
-- Requires:
--   - 20260325_init.sql
--   - 20260409_phase2_returned_enum.sql
--   - 20260409_phase2_returned_workflow.sql
-- Purpose:
--   - Restrict draft/returned editing to the requester only
--   - Prevent ADMIN from editing other users' unconfirmed requests
-- =========================================================

begin;

-- ADMIN が他人の DRAFT / RETURNED を編集できないようにする
drop policy if exists "requests_update_draft_owner_or_admin" on public.requests;
create policy "requests_update_draft_owner_or_admin"
on public.requests for update
using (
  requester_id = auth.uid()
  and status in ('DRAFT', 'RETURNED')
)
with check (
  requester_id = auth.uid()
  and status in ('DRAFT', 'RETURNED')
);

commit;