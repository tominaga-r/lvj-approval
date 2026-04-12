-- =========================================================
-- Phase 2: RETURNED workflow / RPC updates
-- Requires:
--   - 20260325_init.sql
--   - 20260409_phase2_returned_enum.sql
-- =========================================================

begin;

-- 1) 申請者は RETURNED も再編集可
drop policy if exists "requests_update_draft_owner_or_admin" on public.requests;
create policy "requests_update_draft_owner_or_admin"
on public.requests for update
using (
  (public.current_role() = 'ADMIN' and status in ('DRAFT','RETURNED'))
  or (requester_id = auth.uid() and status in ('DRAFT','RETURNED'))
)
with check (
  (public.current_role() = 'ADMIN' and status in ('DRAFT','RETURNED'))
  or (requester_id = auth.uid() and status in ('DRAFT','RETURNED'))
);

-- 2) 提出（DRAFT / RETURNED -> SUBMITTED）
create or replace function public.submit_request(
  p_request_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests;
begin
  select * into v_req
  from public.requests
  where id = p_request_id;

  if not found then
    raise exception 'request not found';
  end if;

  if v_req.requester_id <> auth.uid() and public.current_role() <> 'ADMIN' then
    raise exception 'not allowed';
  end if;

  if v_req.status not in ('DRAFT','RETURNED') then
    raise exception 'only DRAFT/RETURNED can be submitted';
  end if;

  update public.requests
  set status = 'SUBMITTED'
  where id = p_request_id;

  insert into public.request_actions (request_id, actor_id, action, comment)
  values (p_request_id, auth.uid(), 'SUBMIT', p_comment);
end;
$$;

-- 3) 承認 / 却下（SUBMITTED -> APPROVED / REJECTED）
--    自分が申請者の案件は決裁不可
create or replace function public.decide_request(
  p_request_id uuid,
  p_decision text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests;
  v_target_status public.request_status;
  v_action public.request_action_type;
begin
  if public.current_role() <> 'APPROVER' and public.current_role() <> 'ADMIN' then
    raise exception 'only approver/admin can decide';
  end if;

  select * into v_req
  from public.requests
  where id = p_request_id;

  if not found then
    raise exception 'request not found';
  end if;

  if v_req.requester_id = auth.uid() then
    raise exception 'self approval/rejection is not allowed';
  end if;

  if public.current_role() = 'APPROVER' then
    if v_req.department <> public.current_department() then
      raise exception 'not allowed for other department';
    end if;
  end if;

  if v_req.status <> 'SUBMITTED' then
    raise exception 'only SUBMITTED can be decided';
  end if;

  if upper(p_decision) = 'APPROVE' then
    v_target_status := 'APPROVED';
    v_action := 'APPROVE';
  elsif upper(p_decision) = 'REJECT' then
    v_target_status := 'REJECTED';
    v_action := 'REJECT';
  else
    raise exception 'decision must be APPROVE or REJECT';
  end if;

  update public.requests
  set status = v_target_status,
      approver_id = auth.uid()
  where id = p_request_id;

  insert into public.request_actions (request_id, actor_id, action, comment)
  values (p_request_id, auth.uid(), v_action, p_comment);
end;
$$;

-- 4) 差し戻し（SUBMITTED -> RETURNED）
--    自分が申請者の案件は差し戻し不可
create or replace function public.return_request(
  p_request_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests;
begin
  if public.current_role() <> 'APPROVER' and public.current_role() <> 'ADMIN' then
    raise exception 'only approver/admin can return';
  end if;

  select * into v_req
  from public.requests
  where id = p_request_id;

  if not found then
    raise exception 'request not found';
  end if;

  if v_req.requester_id = auth.uid() then
    raise exception 'self return is not allowed';
  end if;

  if public.current_role() = 'APPROVER' then
    if v_req.department <> public.current_department() then
      raise exception 'not allowed for other department';
    end if;
  end if;

  if v_req.status <> 'SUBMITTED' then
    raise exception 'only SUBMITTED can be returned';
  end if;

  update public.requests
  set status = 'RETURNED',
      approver_id = auth.uid()
  where id = p_request_id;

  insert into public.request_actions (request_id, actor_id, action, comment)
  values (p_request_id, auth.uid(), 'RETURN', p_comment);
end;
$$;

grant execute on function public.submit_request(uuid, text) to authenticated;
grant execute on function public.decide_request(uuid, text, text) to authenticated;
grant execute on function public.return_request(uuid, text) to authenticated;

commit;