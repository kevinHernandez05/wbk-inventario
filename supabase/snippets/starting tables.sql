-- =========================================
-- Inventario (MVP) - Supabase / Postgres
-- Multi-tenant con RLS + Kardex + Balances
-- =========================================

-- 0) Extensiones comunes (Supabase normalmente ya las tiene)
create extension if not exists "pgcrypto";

-- 1) Esquema
create schema if not exists inv;

-- 2) Helpers: updated_at trigger
create or replace function inv.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3) Multi-tenant: organizaciones y miembros
create table if not exists inv.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null -- auth.users.id (opcional)
);

create unique index if not exists orgs_slug_uq on inv.orgs (slug);

create table if not exists inv.org_members (
  org_id uuid not null references inv.orgs(id) on delete cascade,
  user_id uuid not null, -- auth.users.id
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_members_user_idx on inv.org_members(user_id);

create trigger trg_orgs_updated_at
before update on inv.orgs
for each row execute function inv.set_updated_at();

-- 4) Catálogos base
create table if not exists inv.categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references inv.orgs(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists categories_org_name_uq on inv.categories(org_id, lower(name));
create index if not exists categories_org_idx on inv.categories(org_id);

create trigger trg_categories_updated_at
before update on inv.categories
for each row execute function inv.set_updated_at();

create table if not exists inv.warehouses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references inv.orgs(id) on delete cascade,
  name text not null,
  location text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists warehouses_org_name_uq on inv.warehouses(org_id, lower(name));
create index if not exists warehouses_org_idx on inv.warehouses(org_id);

create trigger trg_warehouses_updated_at
before update on inv.warehouses
for each row execute function inv.set_updated_at();

-- 5) Productos
create table if not exists inv.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references inv.orgs(id) on delete cascade,
  category_id uuid null references inv.categories(id) on delete set null,

  sku text not null,
  name text not null,
  unit text not null default 'unit', -- unit, kg, lt, etc.
  cost numeric(12,2) not null default 0 check (cost >= 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  min_stock numeric(12,3) not null default 0 check (min_stock >= 0),
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_org_sku_uq on inv.products(org_id, lower(sku));
create index if not exists products_org_idx on inv.products(org_id);
create index if not exists products_category_idx on inv.products(category_id);

create trigger trg_products_updated_at
before update on inv.products
for each row execute function inv.set_updated_at();

-- 6) Movimientos (Kardex)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'movement_type' and typnamespace = 'inv'::regnamespace) then
    create type inv.movement_type as enum ('in','out','adjust');
  end if;
end $$;

create table if not exists inv.movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references inv.orgs(id) on delete cascade,

  movement_type inv.movement_type not null,
  product_id uuid not null references inv.products(id) on delete restrict,
  warehouse_id uuid not null references inv.warehouses(id) on delete restrict,

  qty numeric(12,3) not null check (qty > 0),
  -- Para adjust: usamos direction (+/-) con qty positivo
  direction smallint not null default 1 check (direction in (-1, 1)),

  reason text null,         -- "Compra", "Venta", "Merma", "Ajuste inventario"
  reference text null,      -- "OC-9001", "VENTA", etc.
  note text null,

  created_at timestamptz not null default now(),
  created_by uuid null -- auth.users.id (cuando conectes auth)
);

create index if not exists movements_org_created_at_idx on inv.movements(org_id, created_at desc);
create index if not exists movements_prod_idx on inv.movements(product_id);
create index if not exists movements_wh_idx on inv.movements(warehouse_id);

-- 7) Stock actual (materializado por almacén)
create table if not exists inv.stock_balances (
  org_id uuid not null references inv.orgs(id) on delete cascade,
  product_id uuid not null references inv.products(id) on delete cascade,
  warehouse_id uuid not null references inv.warehouses(id) on delete cascade,
  qty numeric(12,3) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, product_id, warehouse_id)
);

create index if not exists stock_balances_org_idx on inv.stock_balances(org_id);
create index if not exists stock_balances_prod_idx on inv.stock_balances(product_id);

-- 8) Aplicar movimientos → actualizar stock_balances
create or replace function inv.apply_movement_to_balance()
returns trigger
language plpgsql
as $$
declare
  delta numeric(12,3);
begin
  -- delta depende del tipo:
  -- in: +qty
  -- out: -qty
  -- adjust: direction * qty (direction = 1 o -1)
  if new.movement_type = 'in' then
    delta := new.qty;
  elsif new.movement_type = 'out' then
    delta := -new.qty;
  else
    delta := (new.direction * new.qty);
  end if;

  insert into inv.stock_balances(org_id, product_id, warehouse_id, qty, updated_at)
  values (new.org_id, new.product_id, new.warehouse_id, delta, now())
  on conflict (org_id, product_id, warehouse_id)
  do update set
    qty = inv.stock_balances.qty + excluded.qty,
    updated_at = now();

  -- OJO: bloquear stock negativo 
  -- si quieres permitirlo, comenta este bloque
  if (select qty from inv.stock_balances
      where org_id=new.org_id and product_id=new.product_id and warehouse_id=new.warehouse_id) < 0 then
    raise exception 'Stock negativo no permitido (product %, warehouse %)', new.product_id, new.warehouse_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_movement on inv.movements;
create trigger trg_apply_movement
after insert on inv.movements
for each row execute function inv.apply_movement_to_balance();

-- 9) RLS
alter table inv.orgs enable row level security;
alter table inv.org_members enable row level security;
alter table inv.categories enable row level security;
alter table inv.warehouses enable row level security;
alter table inv.products enable row level security;
alter table inv.movements enable row level security;
alter table inv.stock_balances enable row level security;

-- Helper: verificar membresía
create or replace function inv.is_org_member(_org uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from inv.org_members m
    where m.org_id = _org and m.user_id = auth.uid()
  );
$$;

-- Helper: verificar admin/owner
create or replace function inv.is_org_admin(_org uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from inv.org_members m
    where m.org_id = _org
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

-- Policies
-- orgs: leer si soy miembro
drop policy if exists orgs_select on inv.orgs;
create policy orgs_select on inv.orgs
for select
using (inv.is_org_member(id));

-- orgs: insert solo autenticado (opcional)
drop policy if exists orgs_insert on inv.orgs;
create policy orgs_insert on inv.orgs
for insert
with check (auth.uid() is not null);

-- orgs: update solo admin/owner
drop policy if exists orgs_update on inv.orgs;
create policy orgs_update on inv.orgs
for update
using (inv.is_org_admin(id))
with check (inv.is_org_admin(id));

-- org_members: leer si soy miembro de esa org
drop policy if exists org_members_select on inv.org_members;
create policy org_members_select on inv.org_members
for select
using (inv.is_org_member(org_id));

-- org_members: admin/owner gestionan miembros
drop policy if exists org_members_write on inv.org_members;
create policy org_members_write on inv.org_members
for all
using (inv.is_org_admin(org_id))
with check (inv.is_org_admin(org_id));

-- categories
drop policy if exists categories_rw on inv.categories;
create policy categories_rw on inv.categories
for all
using (inv.is_org_member(org_id))
with check (inv.is_org_member(org_id));

-- warehouses
drop policy if exists warehouses_rw on inv.warehouses;
create policy warehouses_rw on inv.warehouses
for all
using (inv.is_org_member(org_id))
with check (inv.is_org_member(org_id));

-- products
drop policy if exists products_rw on inv.products;
create policy products_rw on inv.products
for all
using (inv.is_org_member(org_id))
with check (inv.is_org_member(org_id));

-- movements
drop policy if exists movements_rw on inv.movements;
create policy movements_rw on inv.movements
for all
using (inv.is_org_member(org_id))
with check (inv.is_org_member(org_id));

-- stock_balances: solo lectura para miembros 
drop policy if exists balances_select on inv.stock_balances;
create policy balances_select on inv.stock_balances
for select
using (inv.is_org_member(org_id));

-- Bloquea inserts/updates directos desde el cliente 
drop policy if exists balances_no_write on inv.stock_balances;
create policy balances_no_write on inv.stock_balances
for all
using (false)
with check (false);

-- 10) Dashboard helpers (opcional): views
create or replace view inv.v_dashboard_kpis as
select
  sb.org_id,
  coalesce(sum(sb.qty), 0) as stock_total,
  coalesce(sum(sb.qty * p.cost), 0) as inventory_value,
  coalesce(sum(case when sb.qty < p.min_stock then 1 else 0 end), 0) as low_stock_products
from inv.stock_balances sb
join inv.products p on p.id = sb.product_id
group by sb.org_id;

-- =========================================
-- (Opcional) Seed básico: crea una org + warehouse + categorías
-- Recomendado: ejecuta esto DESPUÉS de crear un usuario y agregarlo a org_members.
-- =========================================
-- -- 1) crea org
-- insert into inv.orgs (name, slug) values ('Inventario Demo', 'inventario-demo') returning id;
--
-- -- 2) agrega tu usuario como owner (cambia auth uid)
-- insert into inv.org_members (org_id, user_id, role)
-- values ('<ORG_ID>', '<AUTH_UID>', 'owner');
--
-- -- 3) crea warehouse y categorías
-- insert into inv.warehouses (org_id, name, location) values ('<ORG_ID>', 'Almacén Principal', 'Santo Domingo');
-- insert into inv.categories (org_id, name) values ('<ORG_ID>', 'Bebidas'), ('<ORG_ID>', 'Snacks'), ('<ORG_ID>', 'Lácteos');


alter table inv.products
add column if not exists discount_percent numeric(5,2) not null default 0
  check (discount_percent >= 0 and discount_percent <= 100);

alter table inv.products
add column if not exists barcode text null;

alter table inv.products
add column if not exists description text null;

alter table inv.products
add column if not exists image_url text null;

alter table inv.products
add column if not exists tax_percent numeric(5,2) not null default 0
  check (tax_percent >= 0 and tax_percent <= 100);

-- Opcional: index para barcode por org si lo usas
create index if not exists products_org_barcode_idx on inv.products(org_id, barcode);

--------------


-- Permitir que la API use el schema
grant usage on schema inv to anon, authenticated;

-- Permitir leer/escribir tablas (RLS seguirá mandando)
grant select, insert, update, delete on all tables in schema inv to anon, authenticated;

-- Si tienes sequences (ids serial, etc.)
grant usage, select on all sequences in schema inv to anon, authenticated;

-- Si tienes funciones (como inv.is_org_member, etc.)
grant execute on all functions in schema inv to anon, authenticated;

-- Para que todo lo nuevo que crees en inv herede permisos
alter default privileges in schema inv
grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema inv
grant usage, select on sequences to anon, authenticated;

alter default privileges in schema inv
grant execute on functions to anon, authenticated;




select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname='inv' and tablename='orgs';


-- default por si acaso (en insert directo)
alter table inv.orgs
alter column created_by set default auth.uid();

-- trigger (por si default no se aplica en algunos inserts)
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



select auth.uid() as my_uid;

update inv.orgs
set created_by = auth.uid()
where id = 'a5d91587-adc9-471a-bc33-239e415b5bec';


insert into inv.org_members (org_id, user_id, role)
values ('a5d91587-adc9-471a-bc33-239e415b5bec', auth.uid(), 'owner');


update inv.orgs
set created_by = '0e78dd06-e116-44b5-8abc-e85e98775e31'
where id = 'a5d91587-adc9-471a-bc33-239e415b5bec';

select id, name, slug, created_by
from inv.orgs
where id = 'a5d91587-adc9-471a-bc33-239e415b5bec';



insert into inv.org_members (org_id, user_id, role)
values (
  'a5d91587-adc9-471a-bc33-239e415b5bec',
  '0e78dd06-e116-44b5-8abc-e85e98775e31',
  'owner'
)
on conflict (org_id, user_id) do update
set role = excluded.role;


select *
from inv.org_members
where org_id = 'a5d91587-adc9-471a-bc33-239e415b5bec'
  and user_id = '0e78dd06-e116-44b5-8abc-e85e98775e31';







  alter table inv.orgs
alter column created_by set default auth.uid();

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






select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname='inv'
order by tablename, policyname;








-- IMPORTANTE: que el search_path incluya inv
create or replace function inv.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = inv, public
as $$
  select exists (
    select 1
    from inv.org_members m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function inv.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = inv, public
as $$
  select exists (
    select 1
    from inv.org_members m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;









alter table inv.orgs enable row level security;

drop policy if exists orgs_select on inv.orgs;
drop policy if exists orgs_insert on inv.orgs;
drop policy if exists orgs_update on inv.orgs;

create policy orgs_select
on inv.orgs
for select
using (
  inv.is_org_member(id) OR created_by = auth.uid()
);

create policy orgs_insert
on inv.orgs
for insert
with check (
  auth.uid() is not null
);

create policy orgs_update
on inv.orgs
for update
using (
  created_by = auth.uid() OR inv.is_org_admin(id)
)
with check (
  created_by = auth.uid() OR inv.is_org_admin(id)
);






alter table inv.org_members enable row level security;

drop policy if exists org_members_select on inv.org_members;
drop policy if exists org_members_insert on inv.org_members;
drop policy if exists org_members_update on inv.org_members;
drop policy if exists org_members_delete on inv.org_members;

create policy org_members_select
on inv.org_members
for select
using (
  user_id = auth.uid() OR inv.is_org_member(org_id)
);

create policy org_members_insert
on inv.org_members
for insert
with check (
  inv.is_org_admin(org_id)
);

create policy org_members_update
on inv.org_members
for update
using (
  inv.is_org_admin(org_id)
)
with check (
  inv.is_org_admin(org_id)
);

create policy org_members_delete
on inv.org_members
for delete
using (
  inv.is_org_admin(org_id)
);






alter table inv.products enable row level security;

drop policy if exists products_select on inv.products;
drop policy if exists products_insert on inv.products;
drop policy if exists products_update on inv.products;
drop policy if exists products_delete on inv.products;

create policy products_select
on inv.products
for select
using (inv.is_org_member(org_id));

create policy products_insert
on inv.products
for insert
with check (inv.is_org_member(org_id));

create policy products_update
on inv.products
for update
using (inv.is_org_member(org_id))
with check (inv.is_org_member(org_id));

create policy products_delete
on inv.products
for delete
using (inv.is_org_admin(org_id));



select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname='inv' and tablename in ('org_members','orgs')
order by tablename, policyname;


drop policy if exists org_members_bootstrap_owner on inv.org_members;
drop policy if exists org_members_write on inv.org_members;
drop policy if exists org_members_insert on inv.org_members;
drop policy if exists org_members_select on inv.org_members;
drop policy if exists org_members_update on inv.org_members;
drop policy if exists org_members_delete on inv.org_members;

select policyname from pg_policies
where schemaname='inv' and tablename='org_members';


alter table inv.org_members disable row level security;
alter table inv.org_members enable row level security;





create policy org_members_select
on inv.org_members
for select
using (
  user_id = auth.uid()
);

create policy org_members_insert
on inv.org_members
for insert
with check (
  true
);

create policy org_members_update
on inv.org_members
for update
using (
  user_id = auth.uid()
);

create policy org_members_delete
on inv.org_members
for delete
using (
  user_id = auth.uid()
);


alter table inv.categories
add column if not exists description text;


alter table inv.categories enable row level security;

drop policy if exists categories_select on inv.categories;
drop policy if exists categories_insert on inv.categories;
drop policy if exists categories_update on inv.categories;
drop policy if exists categories_delete on inv.categories;

create policy categories_select
on inv.categories
for select
using (inv.is_org_member(org_id));

create policy categories_insert
on inv.categories
for insert
with check (inv.is_org_member(org_id));

create policy categories_update
on inv.categories
for update
using (inv.is_org_member(org_id))
with check (inv.is_org_member(org_id));

create policy categories_delete
on inv.categories
for delete
using (inv.is_org_admin(org_id));








alter table inv.warehouses
add column if not exists code text;

alter table inv.warehouses
add column if not exists location text;

alter table inv.warehouses
add column if not exists is_primary boolean default false;

alter table inv.warehouses
add column if not exists active boolean default true;








alter table inv.warehouses enable row level security;

drop policy if exists warehouses_select on inv.warehouses;
drop policy if exists warehouses_insert on inv.warehouses;
drop policy if exists warehouses_update on inv.warehouses;
drop policy if exists warehouses_delete on inv.warehouses;

create policy warehouses_select
on inv.warehouses
for select
using (inv.is_org_member(org_id));

create policy warehouses_insert
on inv.warehouses
for insert
with check (inv.is_org_member(org_id));

create policy warehouses_update
on inv.warehouses
for update
using (inv.is_org_member(org_id))
with check (inv.is_org_member(org_id));

create policy warehouses_delete
on inv.warehouses
for delete
using (inv.is_org_admin(org_id));


create table inv.inventory_movements(
id uuid primary key,
org_id uuid not null,
name text not null,
code text,
location text,
is_primary boolean default false,
active boolean default true,
created_at timestamptz default now(),
updated_at timestamptz default now()

);

alter table inv.inventory_movements
add column if not exists type text not null;

alter table inv.inventory_movements
add column if not exists quantity numeric not null;

alter table inv.inventory_movements
add column if not exists product_id uuid not null;

alter table inv.inventory_movements
add column if not exists warehouse_id uuid not null;

alter table inv.inventory_movements
add column if not exists reference text;

alter table inv.inventory_movements
add column if not exists notes text;

alter table inv.inventory_movements
add column if not exists created_by uuid;


alter table inv.inventory_movements
alter column id set default gen_random_uuid();


alter table inv.inventory_movements
add constraint inventory_movements_type_check
check (type in ('in','out','transfer'));



alter table inv.inventory_movements enable row level security;

drop policy if exists movements_select on inv.inventory_movements;
drop policy if exists movements_insert on inv.inventory_movements;
drop policy if exists movements_update on inv.inventory_movements;
drop policy if exists movements_delete on inv.inventory_movements;

create policy movements_select
on inv.inventory_movements
for select
using (inv.is_org_member(org_id));

create policy movements_insert
on inv.inventory_movements
for insert
with check (inv.is_org_member(org_id));

create policy movements_update
on inv.inventory_movements
for update
using (inv.is_org_admin(org_id))
with check (inv.is_org_admin(org_id));

create policy movements_delete
on inv.inventory_movements
for delete
using (inv.is_org_admin(org_id));



create or replace view inv.stock_balances as
select
  org_id,
  product_id,
  warehouse_id,
  sum(
    case
      when type = 'in' then quantity
      when type = 'out' then -quantity
      else 0
    end
  ) as stock
from inv.inventory_movements
group by org_id, product_id, warehouse_id;





alter table inv.inventory_movements
add column if not exists origin text;




-- (opcional pero recomendado) indices para performance
create index if not exists idx_inventory_movements_product_id
  on inv.inventory_movements(product_id);

create index if not exists idx_inventory_movements_warehouse_id
  on inv.inventory_movements(warehouse_id);

-- FK hacia products
alter table inv.inventory_movements
  add constraint inventory_movements_product_id_fkey
  foreign key (product_id) references inv.products(id)
  on delete restrict;

-- FK hacia warehouses
alter table inv.inventory_movements
  add constraint inventory_movements_warehouse_id_fkey
  foreign key (warehouse_id) references inv.warehouses(id)
  on delete restrict;
