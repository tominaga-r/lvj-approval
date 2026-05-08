-- =========================================================
-- Phase 4: user deactivation
-- Purpose:
--   - Add active / inactive flag to profiles
--   - Keep historical requests / actions while blocking inactive users at app layer
--   - Add audit action constraint including user active state changes
-- =========================================================

begin;

alter table public.profiles
  add column if not exists is_active boolean not null default true;

comment on column public.profiles.is_active is
  'Whether the user is allowed to use the application. Historical records are preserved when false.';

alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_action_check;

alter table public.admin_audit_logs
  add constraint admin_audit_logs_action_check
  check (
    action in (
      'INVITE_USER',
      'UPDATE_USER_ROLE',
      'UPDATE_USER_DEPARTMENT',
      'UPDATE_USER_ACTIVE',
      'CREATE_REQUEST_TYPE',
      'RENAME_REQUEST_TYPE',
      'DELETE_REQUEST_TYPE'
    )
  );

commit;