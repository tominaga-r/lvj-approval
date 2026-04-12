-- =========================================================
-- Phase 2: RETURNED enum additions
-- =========================================================

do $$ begin
  alter type public.request_status add value 'RETURNED';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter type public.request_action_type add value 'RETURN';
exception
  when duplicate_object then null;
end $$;