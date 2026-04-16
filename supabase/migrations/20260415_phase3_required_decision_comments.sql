-- =========================================================
-- Phase 3: require comments for return / reject decisions
-- Requires:
--   - 20260325_init.sql
--   - 20260409_phase2_returned_enum.sql
--   - 20260409_phase2_returned_workflow.sql
-- Optional but recommended before this migration:
--   - 20260415_phase3_admin_permission_review.sql
-- Purpose:
--   - Require comment for RETURN
--   - Require comment for REJECT
--   - Keep APPROVE comment optional
-- =========================================================

begin;

-- 差し戻しコメント必須化
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
  v_comment text;
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

  v_comment := nullif(btrim(coalesce(p_comment, '')), '');
  if v_comment is null then
    raise exception 'return comment is required';
  end if;

  update public.requests
  set status = 'RETURNED',
      approver_id = auth.uid()
  where id = p_request_id;

  insert into public.request_actions (request_id, actor_id, action, comment)
  values (p_request_id, auth.uid(), 'RETURN', v_comment);
end;
$$;

-- 却下コメント必須化（承認コメントは任意のまま）
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
  v_comment text;
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

  v_comment := nullif(btrim(coalesce(p_comment, '')), '');

  if upper(p_decision) = 'APPROVE' then
    v_target_status := 'APPROVED';
    v_action := 'APPROVE';
  elsif upper(p_decision) = 'REJECT' then
    if v_comment is null then
      raise exception 'reject comment is required';
    end if;
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
  values (p_request_id, auth.uid(), v_action, v_comment);
end;
$$;

grant execute on function public.decide_request(uuid, text, text) to authenticated;
grant execute on function public.return_request(uuid, text) to authenticated;

commit;