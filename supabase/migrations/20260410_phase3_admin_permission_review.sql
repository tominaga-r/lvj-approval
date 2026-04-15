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