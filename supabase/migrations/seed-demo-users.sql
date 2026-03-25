-- supabase/seed-demo-users.sql
-- Demo users setup for local portfolio demonstration
-- Prerequisite:
-- 1) Create users first in Supabase Auth dashboard
-- 2) Confirm that profiles are auto-created by trigger
-- 3) Replace the email addresses below with your demo accounts

begin;

update public.profiles
set role = 'REQUESTER',
    department = 'SALES'
where id = (
  select id from auth.users where email = 'requester@example.com'
);

update public.profiles
set role = 'APPROVER',
    department = 'SALES'
where id = (
  select id from auth.users where email = 'approver@example.com'
);

update public.profiles
set role = 'ADMIN',
    department = 'HQ'
where id = (
  select id from auth.users where email = 'admin@example.com'
);

commit;