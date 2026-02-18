-- 2.1: En orgs, autollenar created_by = auth.uid()
create or replace function inv.set_created_by()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orgs_created_by on inv.orgs;
create trigger trg_orgs_created_by
before insert on inv.orgs
for each row execute function inv.set_created_by();

-- 2.2: Permitir que el creador de la org se agregue como owner
-- SOLO si la org aún no tiene miembros.
drop policy if exists org_members_bootstrap_owner on inv.org_members;
create policy org_members_bootstrap_owner on inv.org_members
for insert
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1 from inv.orgs o
    where o.id = org_id
      and o.created_by = auth.uid()
  )
  and not exists (
    select 1 from inv.org_members m
    where m.org_id = org_id
  )
);
