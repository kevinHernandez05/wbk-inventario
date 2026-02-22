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







create table if not exists inv.suppliers (
    id uuid primary key default gen_random_uuid(),

    org_id uuid not null,
    name text not null,

    email text,
    phone text,

    active boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    created_by uuid
);






alter table inv.suppliers
add constraint suppliers_org_fk
foreign key (org_id)
references inv.orgs(id)
on delete cascade;






create or replace function inv.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_suppliers_updated_at on inv.suppliers;

create trigger trg_suppliers_updated_at
before update on inv.suppliers
for each row
execute function inv.set_updated_at();





alter table inv.suppliers enable row level security;




create policy suppliers_select
on inv.suppliers
for select
using (
  exists (
    select 1
    from inv.org_members m
    where m.org_id = suppliers.org_id
      and m.user_id = auth.uid()
  )
);





create policy suppliers_insert
on inv.suppliers
for insert
with check (
  exists (
    select 1
    from inv.org_members m
    where m.org_id = suppliers.org_id
      and m.user_id = auth.uid()
  )
);





create policy suppliers_update
on inv.suppliers
for update
using (
  exists (
    select 1
    from inv.org_members m
    where m.org_id = suppliers.org_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from inv.org_members m
    where m.org_id = suppliers.org_id
      and m.user_id = auth.uid()
  )
);







create policy suppliers_delete
on inv.suppliers
for delete
using (
  exists (
    select 1
    from inv.org_members m
    where m.org_id = suppliers.org_id
      and m.user_id = auth.uid()
  )
);




create table if not exists inv.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references inv.orgs(id) on delete cascade,

  supplier_id uuid references inv.suppliers(id) on delete set null,

  reference text,
  status text not null default 'draft', -- draft | sent | received | cancelled

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists purchase_orders_org_id_idx on inv.purchase_orders(org_id);
create index if not exists purchase_orders_supplier_id_idx on inv.purchase_orders(supplier_id);
create index if not exists purchase_orders_created_at_idx on inv.purchase_orders(created_at desc);




create table if not exists inv.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references inv.orgs(id) on delete cascade,
  purchase_order_id uuid not null references inv.purchase_orders(id) on delete cascade,

  product_id uuid references inv.products(id) on delete set null,

  quantity numeric not null default 1,
  unit_cost numeric not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists po_items_po_id_idx on inv.purchase_order_items(purchase_order_id);
create index if not exists po_items_org_id_idx on inv.purchase_order_items(org_id);





create or replace function inv.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_purchase_orders_updated_at on inv.purchase_orders;

create trigger trg_purchase_orders_updated_at
before update on inv.purchase_orders
for each row execute function inv.set_updated_at();














alter table inv.purchase_orders enable row level security;
alter table inv.purchase_order_items enable row level security;

-- purchase_orders SELECT
create policy po_select
on inv.purchase_orders
for select
using (
  exists (
    select 1 from inv.org_members m
    where m.org_id = purchase_orders.org_id
      and m.user_id = auth.uid()
  )
);

-- purchase_orders INSERT
create policy po_insert
on inv.purchase_orders
for insert
with check (
  exists (
    select 1 from inv.org_members m
    where m.org_id = purchase_orders.org_id
      and m.user_id = auth.uid()
  )
);

-- purchase_orders UPDATE
create policy po_update
on inv.purchase_orders
for update
using (
  exists (
    select 1 from inv.org_members m
    where m.org_id = purchase_orders.org_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from inv.org_members m
    where m.org_id = purchase_orders.org_id
      and m.user_id = auth.uid()
  )
);

-- purchase_orders DELETE
create policy po_delete
on inv.purchase_orders
for delete
using (
  exists (
    select 1 from inv.org_members m
    where m.org_id = purchase_orders.org_id
      and m.user_id = auth.uid()
  )
);

-- items SELECT
create policy po_items_select
on inv.purchase_order_items
for select
using (
  exists (
    select 1 from inv.org_members m
    where m.org_id = purchase_order_items.org_id
      and m.user_id = auth.uid()
  )
);

-- items INSERT/UPDATE/DELETE (mismo patrón)
create policy po_items_insert
on inv.purchase_order_items
for insert
with check (
  exists (
    select 1 from inv.org_members m
    where m.org_id = purchase_order_items.org_id
      and m.user_id = auth.uid()
  )
);

create policy po_items_update
on inv.purchase_order_items
for update
using (
  exists (
    select 1 from inv.org_members m
    where m.org_id = purchase_order_items.org_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from inv.org_members m
    where m.org_id = purchase_order_items.org_id
      and m.user_id = auth.uid()
  )
);

create policy po_items_delete
on inv.purchase_order_items
for delete
using (
  exists (
    select 1 from inv.org_members m
    where m.org_id = purchase_order_items.org_id
      and m.user_id = auth.uid()
  )
);




alter table inv.products
  add column if not exists cost numeric default 0;

alter table inv.products
  add column if not exists min_stock integer default 0;

alter table inv.products
  add column if not exists discount_pct numeric default 0;





  create or replace function inv.report_stock_by_product(p_org uuid)
returns table (
  product_id uuid,
  sku text,
  name text,
  stock numeric,
  min_stock integer
)
language sql
stable
as $$
  select
    p.id as product_id,
    p.sku,
    p.name,
    coalesce(sum(
      case
        when m.type = 'in' then m.quantity
        when m.type = 'out' then -m.quantity
        else 0
      end
    ), 0) as stock,
    coalesce(p.min_stock, 0) as min_stock
  from inv.products p
  left join inv.inventory_movements m
    on m.org_id = p.org_id
   and m.product_id = p.id
  where p.org_id = p_org
    and exists (
      select 1 from inv.org_members om
      where om.org_id = p_org
        and om.user_id = auth.uid()
    )
  group by p.id, p.sku, p.name, p.min_stock
  order by p.name;
$$;






create or replace function inv.report_low_stock(p_org uuid)
returns table (
  product_id uuid,
  sku text,
  name text,
  stock numeric,
  min_stock integer
)
language sql
stable
as $$
  select *
  from inv.report_stock_by_product(p_org)
  where stock <= min_stock
  order by stock asc, name asc;
$$;





grant execute on function inv.report_stock_by_product(uuid) to authenticated;
grant execute on function inv.report_low_stock(uuid) to authenticated;




create table if not exists inv.settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references inv.orgs(id) on delete cascade,

  business_name text not null default 'Inventario',
  currency text not null default 'DOP', -- DOP | USD | EUR

  low_stock_threshold integer not null default 0,
  enable_alerts boolean not null default true,

  time_zone text not null default 'America/Santo_Domingo',
  date_format text not null default 'YYYY-MM-DD',
  require_reference_on_movements boolean not null default false,

  default_warehouse_id uuid references inv.warehouses(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create unique index if not exists settings_org_unique on inv.settings(org_id);




create or replace function inv.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_settings_updated_at on inv.settings;

create trigger trg_settings_updated_at
before update on inv.settings
for each row execute function inv.set_updated_at();




alter table inv.settings enable row level security;

create policy settings_select
on inv.settings
for select
using (
  exists (
    select 1 from inv.org_members m
    where m.org_id = settings.org_id
      and m.user_id = auth.uid()
  )
);

create policy settings_insert
on inv.settings
for insert
with check (
  exists (
    select 1 from inv.org_members m
    where m.org_id = settings.org_id
      and m.user_id = auth.uid()
  )
);

create policy settings_update
on inv.settings
for update
using (
  exists (
    select 1 from inv.org_members m
    where m.org_id = settings.org_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from inv.org_members m
    where m.org_id = settings.org_id
      and m.user_id = auth.uid()
  )
);

create policy settings_delete
on inv.settings
for delete
using (
  exists (
    select 1 from inv.org_members m
    where m.org_id = settings.org_id
      and m.user_id = auth.uid()
  )
);





create or replace function inv.dashboard_kpis(p_org uuid)
returns table (
  stock_total numeric,
  low_stock_count integer,
  inventory_value numeric,
  movements_today integer
)
language sql
stable
as $$
  with stock as (
    select
      p.id as product_id,
      coalesce(sum(
        case
          when m.type = 'in' then m.quantity
          when m.type = 'out' then -m.quantity
          else 0
        end
      ), 0) as stock_qty,
      coalesce(p.min_stock, 0) as min_stock,
      coalesce(p.cost, 0) as cost
    from inv.products p
    left join inv.inventory_movements m
      on m.org_id = p.org_id
     and m.product_id = p.id
    where p.org_id = p_org
      and exists (
        select 1 from inv.org_members om
        where om.org_id = p_org
          and om.user_id = auth.uid()
      )
    group by p.id, p.min_stock, p.cost
  ),
  today_moves as (
    select count(*)::int as c
    from inv.inventory_movements m
    where m.org_id = p_org
      and m.created_at >= date_trunc('day', now())
      and m.type in ('in','out')
      and exists (
        select 1 from inv.org_members om
        where om.org_id = p_org
          and om.user_id = auth.uid()
      )
  )
  select
    coalesce((select sum(stock_qty) from stock), 0) as stock_total,
    coalesce((select count(*)::int from stock where stock_qty <= min_stock), 0) as low_stock_count,
    coalesce((select sum(stock_qty * cost) from stock), 0) as inventory_value,
    coalesce((select c from today_moves), 0) as movements_today;
$$;

grant execute on function inv.dashboard_kpis(uuid) to authenticated;





create or replace function inv.dashboard_top_products(p_org uuid, p_limit int default 5)
returns table (
  product_id uuid,
  sku text,
  name text,
  qty numeric
)
language sql
stable
as $$
  select
    p.id,
    p.sku,
    p.name,
    coalesce(sum(
      case
        when m.type = 'in' then m.quantity
        when m.type = 'out' then -m.quantity
        else 0
      end
    ), 0) as qty
  from inv.products p
  left join inv.inventory_movements m
    on m.org_id = p.org_id
   and m.product_id = p.id
  where p.org_id = p_org
    and exists (
      select 1 from inv.org_members om
      where om.org_id = p_org
        and om.user_id = auth.uid()
    )
  group by p.id, p.sku, p.name
  order by qty desc, p.name asc
  limit greatest(1, p_limit);
$$;

grant execute on function inv.dashboard_top_products(uuid, int) to authenticated;


create or replace function inv.dashboard_supply(p_org uuid)
returns table (
  month text,
  inbound numeric,
  outbound numeric
)
language sql
stable
as $$
  with m as (
    select
      date_trunc('month', created_at) as mth,
      sum(case when type='in' then quantity else 0 end) as inbound,
      sum(case when type='out' then quantity else 0 end) as outbound
    from inv.inventory_movements
    where org_id = p_org
      and created_at >= date_trunc('month', now()) - interval '5 months'
      and type in ('in','out')
      and exists (
        select 1 from inv.org_members om
        where om.org_id = p_org and om.user_id = auth.uid()
      )
    group by 1
  )
  select
    to_char(mth, 'Mon') as month,
    coalesce(inbound,0) as inbound,
    coalesce(outbound,0) as outbound
  from m
  order by mth;
$$;

grant execute on function inv.dashboard_supply(uuid) to authenticated;



create or replace function inv.dashboard_health(p_org uuid)
returns table (
  overall_ok_pct numeric,
  under_pct numeric,
  over_pct numeric,
  low_count int,
  ok_count int,
  over_count int
)
language sql
stable
as $$
  with stock as (
    select
      p.id,
      coalesce(p.min_stock,0) as min_stock,
      coalesce(sum(
        case
          when m.type='in' then m.quantity
          when m.type='out' then -m.quantity
          else 0
        end
      ),0) as qty
    from inv.products p
    left join inv.inventory_movements m
      on m.org_id = p.org_id and m.product_id = p.id
    where p.org_id = p_org
      and exists (
        select 1 from inv.org_members om
        where om.org_id = p_org and om.user_id = auth.uid()
      )
    group by p.id, p.min_stock
  ),
  buckets as (
    select
      count(*)::int as total,
      count(*) filter (where qty <= min_stock)::int as low,
      count(*) filter (where qty > min_stock and qty <= (min_stock * 3))::int as ok,
      count(*) filter (where qty > (min_stock * 3))::int as over
    from stock
  )
  select
    case when total=0 then 0 else round((ok::numeric/total)*100, 0) end as overall_ok_pct,
    case when total=0 then 0 else round((low::numeric/total)*100, 0) end as under_pct,
    case when total=0 then 0 else round((over::numeric/total)*100, 0) end as over_pct,
    low as low_count,
    ok as ok_count,
    over as over_count
  from buckets;
$$;

grant execute on function inv.dashboard_health(uuid) to authenticated;


alter table inv.products
  add column if not exists min_stock numeric default 0;

alter table inv.products
  add column if not exists max_stock numeric;

alter table inv.products
  add column if not exists expiration_date date;





create or replace view inv.v_product_stock as
select
  p.org_id,
  p.id as product_id,
  coalesce(sum(
    case
      when m.type = 'in' then m.quantity
      when m.type = 'out' then -m.quantity
      else 0
    end
  ), 0) as stock
from inv.products p
left join inv.inventory_movements m
  on m.product_id = p.id
 and m.org_id = p.org_id
group by p.org_id, p.id;




create or replace function inv.alert_low_stock(p_org uuid)
returns table (
  product_id uuid,
  sku text,
  name text,
  stock numeric,
  min_stock numeric
)
language sql
security definer
set search_path = inv, public
as $$
  select
    p.id as product_id,
    p.sku,
    p.name,
    s.stock,
    coalesce(p.min_stock, 0) as min_stock
  from inv.products p
  join inv.v_product_stock s
    on s.product_id = p.id
   and s.org_id = p.org_id
  where p.org_id = p_org
    and coalesce(p.active, true) = true
    and s.stock <= coalesce(p.min_stock, 0)
  order by (coalesce(p.min_stock, 0) - s.stock) desc, p.name asc;
$$;

revoke all on function inv.alert_low_stock(uuid) from public;
grant execute on function inv.alert_low_stock(uuid) to authenticated;






create or replace function inv.alerts_overstock(p_org uuid)
returns table (
  product_id uuid,
  sku text,
  name text,
  stock numeric,
  max_stock numeric
)
language sql
security definer
set search_path = inv, public
as $$
  select
    p.id as product_id,
    p.sku,
    p.name,
    s.stock,
    p.max_stock
  from inv.products p
  join inv.v_product_stock s
    on s.product_id = p.id
   and s.org_id = p.org_id
  where p.org_id = p_org
    and coalesce(p.active, true) = true
    and p.max_stock is not null
    and s.stock >= p.max_stock
  order by (s.stock - p.max_stock) desc, p.name asc;
$$;

revoke all on function inv.alerts_overstock(uuid) from public;
grant execute on function inv.alerts_overstock(uuid) to authenticated;






create or replace function inv.alerts_expiring(p_org uuid)
returns table (
  product_id uuid,
  sku text,
  name text,
  expiration_date date,
  days_left int
)
language sql
security definer
set search_path = inv, public
as $$
  select
    p.id as product_id,
    p.sku,
    p.name,
    p.expiration_date,
    (p.expiration_date - current_date) as days_left
  from inv.products p
  where p.org_id = p_org
    and coalesce(p.active, true) = true
    and p.expiration_date is not null
    and p.expiration_date <= (current_date + 30)
  order by p.expiration_date asc, p.name asc;
$$;

revoke all on function inv.alerts_expiring(uuid) from public;
grant execute on function inv.alerts_expiring(uuid) to authenticated;




alter table inv.products
  add column if not exists max_stock numeric(12,3) null;

alter table inv.products
  add column if not exists expiration_date date null;




create or replace view inv.v_product_stock as
select
  p.org_id,
  p.id as product_id,
  coalesce(sum(
    case
      when m.type = 'in' then m.quantity
      when m.type = 'out' then -m.quantity
      else 0
    end
  ), 0) as stock
from inv.products p
left join inv.inventory_movements m
  on m.org_id = p.org_id
 and m.product_id = p.id
group by p.org_id, p.id;




create or replace function inv.alert_low_stock(p_org uuid)
returns table (
  product_id uuid,
  sku text,
  name text,
  stock numeric,
  min_stock numeric
)
language sql
security definer
set search_path = inv, public
as $$
  select
    p.id as product_id,
    p.sku,
    p.name,
    s.stock,
    p.min_stock
  from inv.products p
  join inv.v_product_stock s
    on s.org_id = p.org_id
   and s.product_id = p.id
  where p.org_id = p_org
    and p.active = true
    and s.stock <= p.min_stock
  order by (p.min_stock - s.stock) desc, p.name asc;
$$;

revoke all on function inv.alert_low_stock(uuid) from public;
grant execute on function inv.alert_low_stock(uuid) to authenticated;








create or replace function inv.alerts_overstock(p_org uuid)
returns table (
  product_id uuid,
  sku text,
  name text,
  stock numeric,
  max_stock numeric
)
language sql
security definer
set search_path = inv, public
as $$
  select
    p.id as product_id,
    p.sku,
    p.name,
    s.stock,
    p.max_stock
  from inv.products p
  join inv.v_product_stock s
    on s.org_id = p.org_id
   and s.product_id = p.id
  where p.org_id = p_org
    and p.active = true
    and p.max_stock is not null
    and s.stock >= p.max_stock
  order by (s.stock - p.max_stock) desc, p.name asc;
$$;

revoke all on function inv.alerts_overstock(uuid) from public;
grant execute on function inv.alerts_overstock(uuid) to authenticated;



create or replace function inv.alerts_expiring(p_org uuid)
returns table (
  product_id uuid,
  sku text,
  name text,
  expiration_date date,
  days_left int
)
language sql
security definer
set search_path = inv, public
as $$
  select
    p.id as product_id,
    p.sku,
    p.name,
    p.expiration_date,
    (p.expiration_date - current_date) as days_left
  from inv.products p
  where p.org_id = p_org
    and p.active = true
    and p.expiration_date is not null
    and p.expiration_date <= (current_date + 30)
  order by p.expiration_date asc, p.name asc;
$$;

revoke all on function inv.alerts_expiring(uuid) from public;
grant execute on function inv.alerts_expiring(uuid) to authenticated;