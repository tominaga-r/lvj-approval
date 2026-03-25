-- supabase/migrations/20260325_init.sql
-- Approval Workflow App - initial schema
-- Public portfolio version
-- Intentionally excludes local demo user UUID updates.

begin;

-- =========================================================
-- 0) Extension
-- =========================================================
create extension if not exists "pgcrypto";

-- =========================================================
-- 1) Enums
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('REQUESTER', 'APPROVER', 'ADMIN');
  end if;

  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type public.request_status as enum ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');
  end if;

  if not exists (select 1 from pg_type where typname = 'request_action_type') then
    create type public.request_action_type as enum ('CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'CANCEL');
  end if;
end
$$;

-- =========================================================
-- 2) Tables
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role public.user_role not null default 'REQUESTER',
  department text not null default 'HQ',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.request_types (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  type_id bigint not null references public.request_types(id),
  title text not null,
  description text not null,
  amount numeric(12,2),
  needed_by date,
  status public.request_status not null default 'DRAFT',
  requester_id uuid not null references public.profiles(id),
  approver_id uuid references public.profiles(id),
  department text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.request_actions (
  id bigserial primary key,
  request_id uuid not null references public.requests(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action public.request_action_type not null,
  comment text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Application profile mapped 1:1 with Supabase Auth users';
comment on table public.request_types is 'Master table for request categories';
comment on table public.requests is 'Workflow request entity';
comment on table public.request_actions is 'Audit trail for request operations';

comment on column public.requests.department is
  'Requester department captured at request time for stable authorization and auditability';

-- =========================================================
-- 3) updated_at trigger
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_requests_updated_at on public.requests;
create trigger trg_requests_updated_at
before update on public.requests
for each row execute function public.set_updated_at();

-- =========================================================
-- 4) Helper functions
--    SECURITY DEFINER + row_security = off にして
--    RLS判定用の role / department を安定参照する
-- =========================================================
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.current_department()
returns text
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select department
  from public.profiles
  where id = auth.uid()
$$;

grant execute on function public.current_role() to authenticated;
grant execute on function public.current_department() to authenticated;

-- =========================================================
-- 5) Prevent privilege escalation on profiles
--    非ADMINは role / department を変更できない
-- =========================================================
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if public.current_role() <> 'ADMIN' then
    if new.role is distinct from old.role then
      raise exception 'role cannot be changed by non-admin';
    end if;

    if new.department is distinct from old.department then
      raise exception 'department cannot be changed by non-admin';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_profiles_no_escalation on public.profiles;
create trigger trg_profiles_no_escalation
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

-- =========================================================
-- 6) Auto-create profile on signup
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'User'),
    'REQUESTER',
    'HQ'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- =========================================================
-- 7) Seed request types
-- =========================================================
insert into public.request_types (name)
values
  ('備品購入申請'),
  ('修繕/メンテナンス依頼申請'),
  ('販促/ディスプレイ資材申請')
on conflict (name) do nothing;

-- =========================================================
-- 8) Grants
--    authenticated ロールに必要最小限のテーブル権限を付与
--    実際の許可範囲は RLS で制御
-- =========================================================
grant usage on schema public to authenticated;

grant select, update on public.profiles to authenticated;

grant select, insert, update, delete on public.request_types to authenticated;
grant usage, select on sequence public.request_types_id_seq to authenticated;

grant select, insert, update on public.requests to authenticated;

grant select on public.request_actions to authenticated;

-- =========================================================
-- 9) RLS ON
-- =========================================================
alter table public.profiles enable row level security;
alter table public.request_types enable row level security;
alter table public.requests enable row level security;
alter table public.request_actions enable row level security;

-- =========================================================
-- 10) RLS Policies
-- =========================================================

-- ---------- PROFILES ----------
drop policy if exists "profiles_select_scope" on public.profiles;
create policy "profiles_select_scope"
on public.profiles
for select
using (
  id = auth.uid()
  or public.current_role() = 'ADMIN'
  or (public.current_role() = 'APPROVER' and department = public.current_department())
);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles
for update
using (
  id = auth.uid()
  or public.current_role() = 'ADMIN'
)
with check (
  id = auth.uid()
  or public.current_role() = 'ADMIN'
);

-- INSERT / DELETE は基本禁止
-- profiles は handle_new_user trigger で作成する

-- ---------- REQUEST TYPES ----------
drop policy if exists "request_types_read_all" on public.request_types;
create policy "request_types_read_all"
on public.request_types
for select
using (true);

drop policy if exists "request_types_admin_insert" on public.request_types;
create policy "request_types_admin_insert"
on public.request_types
for insert
with check (public.current_role() = 'ADMIN');

drop policy if exists "request_types_admin_update" on public.request_types;
create policy "request_types_admin_update"
on public.request_types
for update
using (public.current_role() = 'ADMIN')
with check (public.current_role() = 'ADMIN');

drop policy if exists "request_types_admin_delete" on public.request_types;
create policy "request_types_admin_delete"
on public.request_types
for delete
using (public.current_role() = 'ADMIN');

-- ---------- REQUESTS ----------
drop policy if exists "requests_read_scope" on public.requests;
create policy "requests_read_scope"
on public.requests
for select
using (
  public.current_role() = 'ADMIN'
  or requester_id = auth.uid()
  or (public.current_role() = 'APPROVER' and department = public.current_department())
);

drop policy if exists "requests_insert_requester" on public.requests;
create policy "requests_insert_requester"
on public.requests
for insert
with check (
  requester_id = auth.uid()
  and public.current_role() in ('REQUESTER', 'ADMIN')
  and department = public.current_department()
);

drop policy if exists "requests_update_draft_owner_or_admin" on public.requests;
create policy "requests_update_draft_owner_or_admin"
on public.requests
for update
using (
  (public.current_role() = 'ADMIN' and status = 'DRAFT')
  or (requester_id = auth.uid() and status = 'DRAFT')
)
with check (
  (public.current_role() = 'ADMIN' and status = 'DRAFT')
  or (requester_id = auth.uid() and status = 'DRAFT')
);

-- 承認者の直接UPDATEは許可しない
-- 承認 / 却下は RPC (decide_request) のみ

-- ---------- REQUEST ACTIONS ----------
drop policy if exists "actions_read_scope" on public.request_actions;
create policy "actions_read_scope"
on public.request_actions
for select
using (
  exists (
    select 1
    from public.requests r
    where r.id = request_id
      and (
        public.current_role() = 'ADMIN'
        or r.requester_id = auth.uid()
        or (public.current_role() = 'APPROVER' and r.department = public.current_department())
      )
  )
);

-- direct insert policy は作らない
-- 履歴は submit_request / cancel_request / decide_request の RPC 内で記録する

-- =========================================================
-- 11) RPC: workflow state transitions
--     SECURITY DEFINER で直接UPDATE権限を渡さずに実現
-- =========================================================

-- DRAFT -> SUBMITTED
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
  select *
    into v_req
  from public.requests
  where id = p_request_id;

  if not found then
    raise exception 'request not found';
  end if;

  if v_req.requester_id <> auth.uid() and public.current_role() <> 'ADMIN' then
    raise exception 'not allowed';
  end if;

  if v_req.status <> 'DRAFT' then
    raise exception 'only DRAFT can be submitted';
  end if;

  update public.requests
  set status = 'SUBMITTED'
  where id = p_request_id;

  insert into public.request_actions (request_id, actor_id, action, comment)
  values (p_request_id, auth.uid(), 'SUBMIT', p_comment);
end;
$$;

-- DRAFT / SUBMITTED -> CANCELLED
create or replace function public.cancel_request(
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
  select *
    into v_req
  from public.requests
  where id = p_request_id;

  if not found then
    raise exception 'request not found';
  end if;

  if v_req.requester_id <> auth.uid() and public.current_role() <> 'ADMIN' then
    raise exception 'not allowed';
  end if;

  if v_req.status not in ('DRAFT', 'SUBMITTED') then
    raise exception 'only DRAFT/SUBMITTED can be cancelled';
  end if;

  update public.requests
  set status = 'CANCELLED'
  where id = p_request_id;

  insert into public.request_actions (request_id, actor_id, action, comment)
  values (p_request_id, auth.uid(), 'CANCEL', p_comment);
end;
$$;

-- SUBMITTED -> APPROVED / REJECTED
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

  select *
    into v_req
  from public.requests
  where id = p_request_id;

  if not found then
    raise exception 'request not found';
  end if;

  if public.current_role() = 'APPROVER' and v_req.department <> public.current_department() then
    raise exception 'not allowed for other department';
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

grant execute on function public.submit_request(uuid, text) to authenticated;
grant execute on function public.cancel_request(uuid, text) to authenticated;
grant execute on function public.decide_request(uuid, text, text) to authenticated;

commit;