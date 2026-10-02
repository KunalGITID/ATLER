-- Pull asks "what changed since revision N?". Revisions come from a sequence
-- when a row is written, but transactions can commit in a different order:
-- a device could see revision 102, move its cursor past 101, and never see
-- 101 once it commits. Each user's writes now take a per-user lock first, so
-- for any one user a revision is only handed out after every earlier one has
-- committed. Pulls only ever see one user's rows (row-level security), so
-- per-user order is all they need. The lock ends with the transaction.
create or replace function public.atler_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('atler:' || new.user_id::text, 0));
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.revision := nextval('public.atler_revision');
  return new;
end $$;
